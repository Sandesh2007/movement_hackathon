"use client";

/**
 * TradingRecommendation Component
 *
 * Displays trading recommendation data in a formatted, readable way
 */

import React from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Target,
  AlertTriangle,
  BarChart3,
  Heart,
  Clock,
} from "lucide-react";

interface TradingRecommendationData {
  type?: string;
  asset: string;
  recommendation: "BUY" | "SELL" | "HOLD";
  confidence: number;
  current_price: number;
  entry_price?: number;
  stop_loss?: number;
  targets?: {
    target_1?: number;
    target_2?: number;
    target_3?: number;
  };
  technical_indicators?: {
    rsi?: number;
    macd?: {
      histogram?: number;
      macd_line?: number;
      signal?: string;
      signal_line?: number;
    };
    market_phase?: string;
  };
  sentiment_indicators?: {
    sentiment_balance?: number;
    social_volume?: number;
    social_dominance?: number;
  };
  reasons?: string[];
  risk_level?: string;
  timeframe?: string;
  success?: boolean;
}

interface TradingRecommendationProps {
  data: TradingRecommendationData | string;
}

export function TradingRecommendation({ data }: TradingRecommendationProps) {
  // Parse data if it's a string
  let recommendationData: TradingRecommendationData;
  try {
    if (typeof data === "string") {
      recommendationData = JSON.parse(data);
    } else {
      recommendationData = data;
    }
  } catch (e) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
        <p className="text-sm text-red-900 dark:text-red-200">
          Error parsing trading recommendation data
        </p>
      </div>
    );
  }

  const {
    asset,
    recommendation,
    confidence,
    current_price,
    entry_price,
    stop_loss,
    targets,
    technical_indicators,
    sentiment_indicators,
    reasons,
    risk_level,
    timeframe,
  } = recommendationData;

  // Get recommendation color and icon
  const getRecommendationStyle = () => {
    switch (recommendation) {
      case "BUY":
        return {
          bg: "bg-green-50 dark:bg-green-900/20",
          border: "border-green-300 dark:border-green-700",
          text: "text-green-900 dark:text-green-200",
          icon: (
            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
          ),
          badge: "bg-green-600 text-white",
        };
      case "SELL":
        return {
          bg: "bg-red-50 dark:bg-red-900/20",
          border: "border-red-300 dark:border-red-700",
          text: "text-red-900 dark:text-red-200",
          icon: (
            <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
          ),
          badge: "bg-red-600 text-white",
        };
      case "HOLD":
        return {
          bg: "bg-yellow-50 dark:bg-yellow-900/20",
          border: "border-yellow-300 dark:border-yellow-700",
          text: "text-yellow-900 dark:text-yellow-200",
          icon: (
            <Minus className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          ),
          badge: "bg-yellow-600 text-white",
        };
      default:
        return {
          bg: "bg-zinc-50 dark:bg-zinc-900",
          border: "border-zinc-300 dark:border-zinc-700",
          text: "text-zinc-900 dark:text-zinc-100",
          icon: <Minus className="h-5 w-5" />,
          badge: "bg-zinc-600 text-white",
        };
    }
  };

  const style = getRecommendationStyle();

  // Get risk level color
  const getRiskColor = (risk?: string) => {
    if (!risk) return "text-zinc-600 dark:text-zinc-400";
    const riskLower = risk.toLowerCase();
    if (riskLower.includes("low")) return "text-green-600 dark:text-green-400";
    if (riskLower.includes("high")) return "text-red-600 dark:text-red-400";
    return "text-yellow-600 dark:text-yellow-400";
  };

  return (
    <div
      className={`rounded-xl border-2 ${style.border} ${style.bg} p-6 shadow-lg`}
    >
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {style.icon}
          <div>
            <h3 className="text-lg font-bold capitalize text-zinc-900 dark:text-zinc-100">
              {asset} Trading Recommendation
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {timeframe || "Analysis"}
            </p>
          </div>
        </div>
        <div
          className={`rounded-full px-4 py-2 font-bold ${style.badge} shadow-md`}
        >
          {recommendation}
        </div>
      </div>

      {/* Main Metrics */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-white/50 p-3 dark:bg-zinc-800/50">
          <div className="mb-1 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Current Price
            </span>
          </div>
          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            $
            {typeof current_price === "number"
              ? current_price.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : current_price}
          </p>
        </div>

        <div className="rounded-lg bg-white/50 p-3 dark:bg-zinc-800/50">
          <div className="mb-1 flex items-center gap-2">
            <Target className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Confidence
            </span>
          </div>
          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {typeof confidence === "number"
              ? `${confidence.toFixed(1)}%`
              : confidence}
          </p>
        </div>

        {entry_price && (
          <div className="rounded-lg bg-white/50 p-3 dark:bg-zinc-800/50">
            <div className="mb-1 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Entry Price
              </span>
            </div>
            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              $
              {typeof entry_price === "number"
                ? entry_price.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : entry_price}
            </p>
          </div>
        )}

        {stop_loss && (
          <div className="rounded-lg bg-white/50 p-3 dark:bg-zinc-800/50">
            <div className="mb-1 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Stop Loss
              </span>
            </div>
            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              $
              {typeof stop_loss === "number"
                ? stop_loss.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : stop_loss}
            </p>
          </div>
        )}
      </div>

      {/* Targets */}
      {targets && Object.keys(targets).length > 0 && (
        <div className="mb-6">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <Target className="h-4 w-4" />
            Price Targets
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {targets.target_1 && (
              <div className="rounded-lg bg-white/50 p-3 dark:bg-zinc-800/50">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Target 1
                </p>
                <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  $
                  {typeof targets.target_1 === "number"
                    ? targets.target_1.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : targets.target_1}
                </p>
              </div>
            )}
            {targets.target_2 && (
              <div className="rounded-lg bg-white/50 p-3 dark:bg-zinc-800/50">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Target 2
                </p>
                <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  $
                  {typeof targets.target_2 === "number"
                    ? targets.target_2.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : targets.target_2}
                </p>
              </div>
            )}
            {targets.target_3 && (
              <div className="rounded-lg bg-white/50 p-3 dark:bg-zinc-800/50">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Target 3
                </p>
                <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  $
                  {typeof targets.target_3 === "number"
                    ? targets.target_3.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : targets.target_3}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Technical Indicators */}
      {technical_indicators && (
        <div className="mb-6">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <BarChart3 className="h-4 w-4" />
            Technical Indicators
          </h4>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {technical_indicators.rsi !== undefined &&
              technical_indicators.rsi !== null && (
                <div className="rounded-lg bg-white/50 p-3 dark:bg-zinc-800/50">
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    RSI
                  </p>
                  <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {typeof technical_indicators.rsi === "number"
                      ? technical_indicators.rsi.toFixed(1)
                      : technical_indicators.rsi}
                  </p>
                </div>
              )}
            {technical_indicators.macd?.signal && (
              <div className="rounded-lg bg-white/50 p-3 dark:bg-zinc-800/50">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  MACD Signal
                </p>
                <p className="text-base font-bold text-zinc-900 dark:text-zinc-100 capitalize">
                  {technical_indicators.macd.signal}
                </p>
              </div>
            )}
            {technical_indicators.market_phase && (
              <div className="rounded-lg bg-white/50 p-3 dark:bg-zinc-800/50">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Market Phase
                </p>
                <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {technical_indicators.market_phase}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sentiment Indicators */}
      {sentiment_indicators && (
        <div className="mb-6">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <Heart className="h-4 w-4" />
            Sentiment Indicators
          </h4>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {sentiment_indicators.sentiment_balance !== undefined &&
              sentiment_indicators.sentiment_balance !== null && (
                <div className="rounded-lg bg-white/50 p-3 dark:bg-zinc-800/50">
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Sentiment Balance
                  </p>
                  <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {typeof sentiment_indicators.sentiment_balance === "number"
                      ? sentiment_indicators.sentiment_balance.toFixed(1)
                      : sentiment_indicators.sentiment_balance}
                  </p>
                </div>
              )}
            {sentiment_indicators.social_volume !== undefined &&
              sentiment_indicators.social_volume !== null && (
                <div className="rounded-lg bg-white/50 p-3 dark:bg-zinc-800/50">
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Social Volume
                  </p>
                  <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {typeof sentiment_indicators.social_volume === "number"
                      ? sentiment_indicators.social_volume.toLocaleString()
                      : sentiment_indicators.social_volume}
                  </p>
                </div>
              )}
            {sentiment_indicators.social_dominance !== undefined &&
              sentiment_indicators.social_dominance !== null && (
                <div className="rounded-lg bg-white/50 p-3 dark:bg-zinc-800/50">
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Social Dominance
                  </p>
                  <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {typeof sentiment_indicators.social_dominance === "number"
                      ? `${sentiment_indicators.social_dominance.toFixed(1)}%`
                      : sentiment_indicators.social_dominance}
                  </p>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Reasons */}
      {reasons && reasons.length > 0 && (
        <div className="mb-6">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <Clock className="h-4 w-4" />
            Reasons for Recommendation
          </h4>
          <ul className="space-y-2">
            {reasons.map((reason, index) => (
              <li
                key={index}
                className="flex items-start gap-2 rounded-lg bg-white/50 p-3 dark:bg-zinc-800/50"
              >
                <span className="mt-0.5 text-green-600 dark:text-green-400">
                  •
                </span>
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  {reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risk Level */}
      {risk_level && (
        <div className="rounded-lg border border-zinc-200 bg-white/50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Risk Level
            </span>
            <span className={`text-sm font-bold ${getRiskColor(risk_level)}`}>
              {risk_level.toUpperCase()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
