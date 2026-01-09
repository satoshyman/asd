
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateBotLogic = async (config: any) => {
  const prompt = `Create a professional Telegram Mini App backend in Python for a FaucetPay integration:
  - Coin to distribute: ${config.coinName} (TON via FaucetPay)
  - Features:
    1. Daily Bonus: User can claim once every 24h.
    2. Cloud Mining: Simulated mining with real rewards added to DB every hour.
    3. FaucetPay API: Integration for instant withdrawals.
    4. Database: PostgreSQL/SQLite to store balances and claim timestamps.
  - Withdrawal Logic: Minimum ${config.minWithdraw} ${config.coinName}.
  - Referral System: User gets ${config.referralPercent}% of friends' earnings.
  Provide the code with clear instructions on how to set the FaucetPay API key.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
    }
  });

  return response.text;
};
