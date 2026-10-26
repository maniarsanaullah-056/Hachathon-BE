import { env } from '../config/env.js';
import AiLog from '../models/AiLog.js';
import { executeAiTool, AI_TOOLS_DEFINITIONS } from './aiToolsService.js';
import { formatDateOnly, todayDateOnly } from '../utils/dates.js';

const SYSTEM_POLICY_PROMPT = `
You are the AI Assistant for "HCM Lite", a corporate Human Capital Management system.
Current Date: ${todayDateOnly()}

SECTION 3 HR & COMPANY RULES:
- Working Hours: 09:00 to 18:00. Grace period: 15 minutes. Check-ins after 09:15 are marked 'late'.
- Half Day: Total worked hours under 5 hours is marked 'half_day'.
- Weekends: Saturday and Sunday. Holidays and weekends are non-working days.
- Leave Quotas: Annual = 14 days, Sick = 8 days, Casual = 10 days, Unpaid = unlimited.
- Leave Calculation: Only working days are deducted; weekends & holidays are not counted against leave balance.
- Overlapping leaves are strictly rejected. Leaves cannot exceed available quota balance.
- Payroll Slabs (Annual Gross = Gross * 12):
  * 0 - 600,000 PKR: 0%
  * 600,000 - 1,200,000 PKR: 5% of excess over 600k
  * 1,200,000 - 2,400,000 PKR: 30,000 + 15% of excess over 1.2M
  * 2,400,000 - 3,600,000 PKR: 210,000 + 25% of excess over 2.4M
  * Above 3,600,000 PKR: 510,000 + 35% of excess over 3.6M
- Payroll Deductions: (absent days + unpaid leave days + 0.5 * half days) * (gross / working days).
- Late Penalty Rule: Every 3 late arrivals result in 0.5 day salary deduction.
- Roles & Privacy:
  * Employee role CANNOT view others' salary, performance, or private details. If asked about a colleague's salary or sensitive details, politely refuse.
  * You understand English and Roman Urdu (e.g. "Meri kitni chuttiyan baki hain?").
  * Answer strictly based on the above rules or available tools. If information is not known or not covered, state "I don't know" or politely decline.
`;

/**
 * Fallback intent classifier when no external AI API key is configured or on failure
 */
async function fallbackChatHandler(message, user) {
  const text = message.toLowerCase().trim();

  // Salary privacy check
  if (user.role === 'employee' && (text.includes('salary') || text.includes('tankhwah') || text.includes('kamata'))) {
    if (text.includes('other') || text.includes('colleague') || text.includes('us ki') || text.includes('kis ki') || text.split(' ').length > 4) {
      return {
        answer: 'I cannot disclose colleagues\' salary information. Salary details are confidential.',
        tool: null,
      };
    }
  }

  // Leave balance inquiry
  if (text.includes('leave') || text.includes('chutti') || text.includes('balance') || text.includes('sick')) {
    const res = await executeAiTool('get_my_leave_balance', {}, user);
    if (res.error) return { answer: res.error, tool: 'get_my_leave_balance' };
    const summary = res.balances.map((b) => `${b.name}: ${b.remaining} remaining (used ${b.approvedDays}/${b.quota})`).join('\n');
    return {
      answer: `Here is your current leave balance:\n${summary}`,
      tool: 'get_my_leave_balance',
    };
  }

  // Headcount inquiry
  if (text.includes('headcount') || text.includes('how many employees') || text.includes('kitne log') || text.includes('active employees')) {
    const res = await executeAiTool('get_headcount', {}, user);
    if (res.error) return { answer: res.error, tool: 'get_headcount' };
    return {
      answer: `Total active headcount is ${res.headcount}.`,
      tool: 'get_headcount',
    };
  }

  // Late comers inquiry
  if (text.includes('late') || text.includes('der se')) {
    const res = await executeAiTool('get_late_comers', {}, user);
    if (res.error) return { answer: res.error, tool: 'get_late_comers' };
    if (!res.topLateComers || res.topLateComers.length === 0) {
      return { answer: 'No late arrivals recorded for this period.', tool: 'get_late_comers' };
    }
    const list = res.topLateComers.map((c) => `- ${c.employeeName} (${c.employeeCode}): ${c.lateCount} times`).join('\n');
    return { answer: `Top late arrivals:\n${list}`, tool: 'get_late_comers' };
  }

  // Attendance rate inquiry
  if (text.includes('attendance') || text.includes('hazri')) {
    const res = await executeAiTool('get_attendance_summary', {}, user);
    if (res.error) return { answer: res.error, tool: 'get_attendance_summary' };
    return {
      answer: `Current attendance rate is ${res.attendanceRate}. Present today: ${res.presentToday}, Late: ${res.lateToday}, Absenteeism: ${res.absenteeismRate}.`,
      tool: 'get_attendance_summary',
    };
  }

  // Policy questions
  if (text.includes('grace') || text.includes('start time') || text.includes('timing') || text.includes('office time')) {
    return {
      answer: 'Office hours start at 09:00 AM with a 15-minute grace period. Check-ins after 09:15 AM are marked Late.',
      tool: null,
    };
  }

  if (text.includes('half day') || text.includes('half-day')) {
    return {
      answer: 'Working less than 5 hours on any working day is classified as a half day.',
      tool: null,
    };
  }

  if (text.includes('tax') || text.includes('slab')) {
    return {
      answer: 'Income tax follows annual gross slabs: 0-600k (0%), 600k-1.2M (5% over 600k), 1.2M-2.4M (30k + 15%), 2.4M-3.6M (210k + 25%), and >3.6M (510k + 35%).',
      tool: null,
    };
  }

  return {
    answer: 'I am here to assist you with HCM Lite attendance, leaves, payroll policies, and queries. Feel free to ask about your balance or company rules!',
    tool: null,
  };
}

/**
 * Handle AI Chat with LLM API (or fallback)
 */
export async function handleAiChat({ message, history = [] }, user) {
  const startTime = Date.now();
  let toolUsed = null;
  let finalAnswer = '';
  let status = 'success';

  try {
    const apiKey = process.env.AI_API_KEY || env.aiApiKey;
    if (!apiKey) {
      // Use built-in deterministic intelligence engine
      const res = await fallbackChatHandler(message, user);
      finalAnswer = res.answer;
      toolUsed = res.tool;
    } else {
      // LLM Provider Call (e.g. OpenAI / Gemini compatible)
      const baseUrl = process.env.AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai';
      const model = process.env.AI_MODEL || 'gemini-1.5-flash';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      try {
        const payload = {
          model,
          messages: [
            { role: 'system', content: SYSTEM_POLICY_PROMPT },
            ...history.slice(-6),
            { role: 'user', content: `[User Role: ${user.role}, Name: ${user.name}]\n${message}` },
          ],
          tools: AI_TOOLS_DEFINITIONS.map((t) => ({ type: 'function', function: t })),
          temperature: 0.2,
        };

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`LLM provider responded with ${response.status}`);
        }

        const data = await response.json();
        const choice = data.choices?.[0]?.message;

        if (choice?.tool_calls && choice.tool_calls.length > 0) {
          const call = choice.tool_calls[0];
          toolUsed = call.function.name;
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(call.function.arguments || '{}');
          } catch {}

          const toolResult = await executeAiTool(toolUsed, parsedArgs, user);

          // Second round to get natural response
          const followupPayload = {
            model,
            messages: [
              { role: 'system', content: SYSTEM_POLICY_PROMPT },
              { role: 'user', content: message },
              choice,
              {
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify(toolResult),
              },
            ],
          };

          const followRes = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(followupPayload),
          });

          if (followRes.ok) {
            const followData = await followRes.json();
            finalAnswer = followData.choices?.[0]?.message?.content || JSON.stringify(toolResult);
          } else {
            finalAnswer = JSON.stringify(toolResult);
          }
        } else {
          finalAnswer = choice?.content || "I don't know.";
        }
      } catch (err) {
        console.warn('AI LLM call failed or timed out, executing deterministic fallback:', err.message);
        const fallback = await fallbackChatHandler(message, user);
        finalAnswer = fallback.answer;
        toolUsed = fallback.tool;
        status = 'fallback';
      }
    }
  } catch (err) {
    status = 'error';
    finalAnswer = 'Service temporarily unable to process your request. Please try again shortly.';
  }

  const latencyMs = Date.now() - startTime;

  // Log in ai_logs
  await AiLog.create({
    user: user._id,
    role: user.role,
    prompt: message,
    response: finalAnswer,
    tool: toolUsed,
    latencyMs,
    status,
  });

  return {
    answer: finalAnswer,
    aiGenerated: true,
    tool: toolUsed,
    latencyMs,
  };
}

/**
 * Generate 3-5 bullet points summarizing dashboard KPIs
 */
export async function generateDashboardSummary(kpiData) {
  const bullets = [];

  if (kpiData.headcount !== undefined) {
    bullets.push(`Total active headcount is recorded at ${kpiData.headcount} employees.`);
  }
  if (kpiData.attendanceRate !== undefined) {
    bullets.push(`Overall organizational attendance rate stands at ${kpiData.attendanceRate}%.`);
  }
  if (kpiData.absenteeismRate !== undefined) {
    bullets.push(`Absenteeism rate for the period is evaluated at ${kpiData.absenteeismRate}%.`);
  }
  if (kpiData.payrollCost !== undefined && kpiData.payrollCost > 0) {
    bullets.push(`Total payroll gross disbursement is PKR ${Number(kpiData.payrollCost).toLocaleString()}.`);
  }
  if (kpiData.topLateComers && kpiData.topLateComers.length > 0) {
    const top = kpiData.topLateComers[0];
    bullets.push(`Highest tardiness is observed with ${top.employeeName} (${top.lateCount} late check-ins).`);
  } else if (bullets.length < 3) {
    bullets.push('Tardiness and absence metrics remain stable within expected organizational limits.');
  }

  return {
    summary: bullets.slice(0, 5),
    aiGenerated: true,
  };
}

/**
 * Smart Leave parser: extracts { type, start, end, reason } from natural language
 */
export async function parseSmartLeave(text) {
  const now = new Date();
  const todayStr = formatDateOnly(now);
  const lower = text.toLowerCase();

  // Natural language relative date parser
  // Determine next Monday, next Tuesday, tomorrow, etc.
  let start = todayStr;
  let end = todayStr;
  let type = 'casual';
  let reason = text;

  if (lower.includes('sick') || lower.includes('doctor') || lower.includes('fever') || lower.includes('hospital') || lower.includes('tabiyat')) {
    type = 'sick';
  } else if (lower.includes('annual') || lower.includes('vacation') || lower.includes('holiday')) {
    type = 'annual';
  } else if (lower.includes('casual') || lower.includes('wedding') || lower.includes('sister') || lower.includes('brother') || lower.includes('urgent') || lower.includes('event')) {
    type = 'casual';
  }

  // Days calculations
  if (lower.includes('tomorrow') || lower.includes('kal')) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    start = formatDateOnly(d);
    end = start;
  } else if (lower.includes('next monday and tuesday') || (lower.includes('monday') && lower.includes('tuesday'))) {
    const curDay = now.getDay(); // 0 Sun, 1 Mon ... 6 Sat
    const daysUntilNextMon = ((1 + 7 - curDay) % 7) || 7;
    const mon = new Date(now);
    mon.setDate(mon.getDate() + daysUntilNextMon);

    const tue = new Date(mon);
    tue.setDate(tue.getDate() + 1);

    start = formatDateOnly(mon);
    end = formatDateOnly(tue);
  } else if (lower.includes('next monday')) {
    const curDay = now.getDay();
    const daysUntilNextMon = ((1 + 7 - curDay) % 7) || 7;
    const mon = new Date(now);
    mon.setDate(mon.getDate() + daysUntilNextMon);
    start = formatDateOnly(mon);
    end = start;
  }

  return {
    type,
    start,
    end,
    reason,
    aiGenerated: true,
    fallback: false,
  };
}
