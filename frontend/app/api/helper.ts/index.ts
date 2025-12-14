import {
  AbstractAgent,
  AgentConfig,
  BaseEvent,
  EventType,
  RunAgentInput,
  ToolCallResultEvent,
  Message,
  ToolCallStartEvent,
  transformChunks,
  AgentSubscriber,
  RunFinishedEventSchema,
  RunFinishedEvent,
  TextMessageStartEvent,
  TextMessageEndEvent,
} from "@ag-ui/client";

import { A2AClient } from "@a2a-js/sdk/client";
import {
  AgentCard,
  SendMessageResponse,
  SendMessageSuccessResponse,
} from "@a2a-js/sdk";
import { Observable, Subscriber, tap } from "rxjs";
import { createSystemPrompt, sendMessageToA2AAgentTool, retryA2AAgentWithPaymentTool } from "./utils";
import { randomUUID } from "@ag-ui/client";

export interface A2AAgentConfig extends AgentConfig {
  agentUrls: string[];
  instructions?: string;
  orchestrationAgent: AbstractAgent;
}

export interface PaymentRequiredError {
  errorCode: number;
  errorType: "PAYMENT_REQUIRED";
  amount: string;
  token: string;
  recipientAddress?: string;
  description?: string;
  originalTask: string;
  agentName: string;
}

export class A2AMiddlewareAgent extends AbstractAgent {
  agentClients: A2AClient[];
  agentCards: Promise<AgentCard[]>;
  instructions?: string;
  orchestrationAgent: AbstractAgent;

  constructor(config: A2AAgentConfig) {
    super(config);
    this.instructions = config.instructions;
    this.agentClients = config.agentUrls.map((url) => new A2AClient(url));
    this.agentCards = Promise.all(
      this.agentClients.map((client) => client.getAgentCard())
    );
    this.orchestrationAgent = config.orchestrationAgent;
  }

  finishTextMessages(
    observer: Subscriber<{
      type: EventType;
      timestamp?: number | undefined;
      rawEvent?: any;
    }>,
    pendingTextMessages: Set<string>
  ): void {
    pendingTextMessages.forEach((messageId) => {
      observer.next({
        type: EventType.TEXT_MESSAGE_END,
        messageId: messageId,
      } as TextMessageEndEvent);
      pendingTextMessages.delete(messageId);
    });
  }

  wrapStream(
    stream: Observable<BaseEvent>,
    pendingA2ACalls: Set<string>,
    pendingTextMessages: Set<string>,
    observer: Subscriber<{
      type: EventType;
      timestamp?: number | undefined;
      rawEvent?: any;
    }>,
    input: RunAgentInput
  ): any {
    const applyAndProcessEvents = (source$: Observable<BaseEvent>) => {
      // Apply events to get mutations
      const mutations$ = this.apply(input, source$, this.subscribers);
      // Process the mutations
      const processedMutations$ = this.processApplyEvents(
        input,
        mutations$,
        this.subscribers
      );
      // Subscribe to the processed mutations to trigger side effects
      processedMutations$.subscribe();
      // Return the original stream to maintain BaseEvent type
      return source$;
    };

    const markTextMessageAsPending = (event: BaseEvent) => {
      if (event.type === EventType.TEXT_MESSAGE_START) {
        const textMessageStartEvent = event as TextMessageStartEvent;
        pendingTextMessages.add(textMessageStartEvent.messageId);
        return;
      }
      if (event.type === EventType.TEXT_MESSAGE_END) {
        const textMessageEndEvent = event as TextMessageEndEvent;
        pendingTextMessages.delete(textMessageEndEvent.messageId);
        return;
      }
    };

    return stream
      .pipe(
        transformChunks(this.debug),
        applyAndProcessEvents,
        tap(markTextMessageAsPending)
      )
      .subscribe({
        next: (event: BaseEvent) => {
          // Handle tool call start events for send_message_to_a2a_agent and retry_a2a_agent_with_payment
          if (
            event.type === EventType.TOOL_CALL_START &&
            "toolCallName" in event &&
            "toolCallId" in event
          ) {
            const toolCallName = (event as ToolCallStartEvent).toolCallName;
            if (
              toolCallName.startsWith("send_message_to_a2a_agent") ||
              toolCallName.startsWith("retry_a2a_agent_with_payment")
            ) {
              // Track this as a pending A2A call
              pendingA2ACalls.add(event.toolCallId as string);
              // Proxy the start event normally
              observer.next(event);
              return;
            }
          }

          // Handle tool call result events for send_message_to_a2a_agent
          if (
            event.type === EventType.TOOL_CALL_RESULT &&
            "toolCallId" in event &&
            pendingA2ACalls.has(event.toolCallId as string)
          ) {
            // This is a result for our A2A tool call
            pendingA2ACalls.delete(event.toolCallId as string);
            observer.next(event);
            return;
          }

          // Handle run completion events
          if (event.type === EventType.RUN_FINISHED) {
            this.finishTextMessages(observer, pendingTextMessages);

            if (pendingA2ACalls.size > 0) {
              // Array to collect all new tool result messages
              const newToolMessages: Message[] = [];

              const callProms = [...pendingA2ACalls].map((toolCallId) => {
                const toolCallsFromMessages = this.messages
                  .filter((message) => message.role === "assistant")
                  .flatMap((message) => message.toolCalls || [])
                  .filter((toolCall) => toolCall.id === toolCallId);

                const toolArgs = toolCallsFromMessages[0]?.function.arguments;
                if (!toolArgs) {
                  throw new Error(
                    `Tool arguments not found for tool call id ${toolCallId}`
                  );
                }
                const parsed = JSON.parse(toolArgs);
                const toolCallName = toolCallsFromMessages[0]?.function.name;
                
                // Check if this is a retry call with payment
                let agentCallPromise: Promise<string>;
                if (toolCallName === "retry_a2a_agent_with_payment") {
                  const agentName = parsed.agentName;
                  const task = parsed.task;
                  const transactionHash = parsed.transactionHash;

                  if (this.debug) {
                    console.debug("retrying a2a agent with payment", {
                      agentName,
                      message: task,
                      transactionHash,
                    });
                  }
                  agentCallPromise = this.sendMessageToA2AAgent(agentName, task, transactionHash);
                } else {
                  // Regular A2A call
                  const agentName = parsed.agentName;
                  const task = parsed.task;

                  if (this.debug) {
                    console.debug("sending message to a2a agent", {
                      agentName,
                      message: task,
                    });
                  }
                  agentCallPromise = this.sendMessageToA2AAgent(agentName, task);
                }
                
                return agentCallPromise
                  .then((a2aResponse) => {
                    const newMessage: Message = {
                      id: randomUUID(),
                      role: "tool",
                      toolCallId: toolCallId,
                      content: a2aResponse,
                    };
                    if (this.debug) {
                      console.debug("newMessage From a2a agent", newMessage);
                    }
                    this.addMessage(newMessage);
                    this.orchestrationAgent.addMessage(newMessage);

                    // Collect the message so we can add it to input.messages
                    newToolMessages.push(newMessage);

                    const newEvent: ToolCallResultEvent = {
                      type: EventType.TOOL_CALL_RESULT,
                      toolCallId: toolCallId,
                      messageId: newMessage.id,
                      content: a2aResponse,
                    };

                    observer.next(newEvent);

                    pendingA2ACalls.delete(toolCallId);
                  })
                  .catch((error: any) => {
                    // Handle payment required errors
                    if (error.paymentRequired && error.paymentDetails) {
                      const paymentDetails = error.paymentDetails as PaymentRequiredError;
                      
                      // Return error response that includes payment details
                      // The orchestrator can then call the payment action
                      const errorMessage = JSON.stringify({
                        error: "PAYMENT_REQUIRED",
                        paymentDetails: paymentDetails,
                        message: `Payment required: ${paymentDetails.description || "Please complete payment to continue"}`,
                      });

                      const newMessage: Message = {
                        id: randomUUID(),
                        role: "tool",
                        toolCallId: toolCallId,
                        content: errorMessage,
                      };
                      
                      if (this.debug) {
                        console.debug("Payment required error", paymentDetails);
                      }
                      
                      this.addMessage(newMessage);
                      this.orchestrationAgent.addMessage(newMessage);
                      newToolMessages.push(newMessage);

                      const newEvent: ToolCallResultEvent = {
                        type: EventType.TOOL_CALL_RESULT,
                        toolCallId: toolCallId,
                        messageId: newMessage.id,
                        content: errorMessage,
                      };

                      observer.next(newEvent);
                      pendingA2ACalls.delete(toolCallId);
                    } else {
                      // For other errors, throw them
                      throw error;
                    }
                  })
                  .finally(() => {
                    pendingA2ACalls.delete(toolCallId as string);
                  });
              });

              Promise.all(callProms).then(() => {
                this.finishTextMessages(observer, pendingTextMessages);
                observer.next({
                  type: EventType.RUN_FINISHED,
                  threadId: input.threadId,
                  runId: input.runId,
                } as RunFinishedEvent);

                // Add all tool result messages to input.messages BEFORE triggering new run
                // This ensures the orchestrator sees the tool results in its context
                newToolMessages.forEach((msg) => {
                  input.messages.push(msg);
                });

                this.triggerNewRun(
                  observer,
                  input,
                  pendingA2ACalls,
                  pendingTextMessages
                );
              });
            } else {
              observer.next(event);
              observer.complete();
              return;
            }
            return;
          }

          // Handle run error events - emit immediately and exit
          if (event.type === EventType.RUN_ERROR) {
            observer.next(event);
            observer.error(event);
            return;
          }

          // Proxy all other events
          observer.next(event);
        },
        error: (error) => {
          observer.error(error);
        },
        complete: () => {
          // Only complete if run is actually finished and no pending calls
          if (pendingA2ACalls.size === 0) {
            observer.complete();
          }
        },
      });
  }

  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>((observer) => {
      const run = async () => {
        let pendingA2ACalls = new Set<string>();
        const pendingTextMessages = new Set<string>();
        const agentCards = await this.agentCards;
        const newSystemPrompt = createSystemPrompt(
          agentCards,
          this.instructions
        );

        const messages = input.messages;
        if (messages.length && messages[0].role === "system") {
          // remove the first message if it is a system message
          messages.shift();
        }

        messages.unshift({
          role: "system",
          content: newSystemPrompt,
          id: randomUUID(),
        });

        input.tools = [
          ...(input.tools || []),
          sendMessageToA2AAgentTool,
          retryA2AAgentWithPaymentTool,
        ];

        // Start the orchestration agent run
        this.triggerNewRun(
          observer,
          input,
          pendingA2ACalls,
          pendingTextMessages
        );
      };
      run();
    });
  }

  private async sendMessageToA2AAgent(
    agentName: string,
    args: string,
    transactionHash?: string
  ): Promise<string> {
    const agentCards = await this.agentCards;

    const agents = agentCards.map((card, index) => {
      return { client: this.agentClients[index], card };
    });

    const agent = agents.find((agent) => agent.card.name === agentName);

    if (!agent) {
      throw new Error(`Agent "${agentName}" not found`);
    }

    const { client } = agent;

    // If we have a transaction hash from a previous payment, include it in the request
    const messageText = transactionHash
      ? `${args}\n\nPayment transaction hash: ${transactionHash}`
      : args;

    const sendResponse: SendMessageResponse = await client.sendMessage({
      message: {
        kind: "message",
        messageId: Date.now().toString(),
        role: "agent",
        parts: [{ text: messageText, kind: "text" }],
      },
    });

    if ("error" in sendResponse) {
      const error = sendResponse.error;
      const errorMessage = error.message || "";
      const errorCode = (error as any).code || (error as any).statusCode;

      // Check for 402 Payment Required error
      if (errorCode === 402 || errorMessage.includes("402") || errorMessage.includes("Payment Required")) {
        // Try to parse payment details from error message
        let paymentDetails: PaymentRequiredError | null = null;
        
        try {
          // Try to parse JSON from error message
          const jsonMatch = errorMessage.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            paymentDetails = {
              errorCode: 402,
              errorType: "PAYMENT_REQUIRED",
              amount: parsed.amount || "0",
              token: parsed.token || "MOVE",
              recipientAddress: parsed.recipientAddress,
              description: parsed.description || `Payment required to continue with ${agentName} agent`,
              originalTask: args,
              agentName: agentName,
            };
          }
        } catch (e) {
          // If parsing fails, create default payment error
        }

        if (!paymentDetails) {
          // Default payment details if we can't parse
          paymentDetails = {
            errorCode: 402,
            errorType: "PAYMENT_REQUIRED",
            amount: "0",
            token: "MOVE",
            description: `Payment required to continue with ${agentName} agent`,
            originalTask: args,
            agentName: agentName,
          };
        }

        // Throw a special error that includes payment details
        const paymentError = new Error(JSON.stringify(paymentDetails));
        (paymentError as any).paymentRequired = true;
        (paymentError as any).paymentDetails = paymentDetails;
        throw paymentError;
      }

      throw new Error(
        `Error sending message to agent "${agentName}": ${errorMessage}`
      );
    }

    const result = (sendResponse as SendMessageSuccessResponse).result;
    let responseContent = "";

    if (
      result.kind === "message" &&
      result.parts.length > 0 &&
      result.parts[0].kind === "text"
    ) {
      responseContent = result.parts[0].text;
    } else {
      responseContent = JSON.stringify(result);
    }

    return responseContent;
  }

  private triggerNewRun(
    observer: any,
    input: RunAgentInput,
    pendingA2ACalls: Set<string>,
    pendingTextMessages: Set<string>
  ): void {
    const newRunStream = this.orchestrationAgent.run(input);
    this.wrapStream(
      newRunStream,
      pendingA2ACalls,
      pendingTextMessages,
      observer,
      input
    );
  }
}
