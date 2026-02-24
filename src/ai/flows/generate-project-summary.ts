'use server';
/**
 * @fileOverview A Genkit flow for generating concise project summaries for admins.
 *
 * - generateProjectSummary - A function that generates a project summary.
 * - GenerateProjectSummaryInput - The input type for the generateProjectSummary function.
 * - GenerateProjectSummaryOutput - The return type for the generateProjectSummary function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateProjectSummaryInputSchema = z.object({
  title: z.string().describe('The title of the project.'),
  budget: z
    .string()
    .describe(
      'The budget allocated for the project, can be a number or a descriptive string.'
    ),
  keyFeatures: z
    .array(z.string())
    .describe('A list of key features or functionalities of the project.'),
  description: z
    .string()
    .optional()
    .describe('An optional longer description or additional details for the project.'),
});
export type GenerateProjectSummaryInput = z.infer<
  typeof GenerateProjectSummaryInputSchema
>;

const GenerateProjectSummaryOutputSchema = z.object({
  summary: z.string().describe('A concise and well-structured project summary.'),
});
export type GenerateProjectSummaryOutput = z.infer<
  typeof GenerateProjectSummaryOutputSchema
>;

export async function generateProjectSummary(
  input: GenerateProjectSummaryInput
): Promise<GenerateProjectSummaryOutput> {
  return generateProjectSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateProjectSummaryPrompt',
  input: { schema: GenerateProjectSummaryInputSchema },
  output: { schema: GenerateProjectSummaryOutputSchema },
  prompt: `As an expert project manager, your task is to generate a concise, compelling, and well-structured summary for a voting session project.

The summary should highlight the project's purpose, key features, and budget in an engaging way, suitable for members to quickly understand and evaluate.
Focus on clarity and impact, keeping the summary to approximately 3-5 sentences.

Project Title: {{{title}}}
Budget: {{{budget}}}
Key Features:
{{#each keyFeatures}}- {{{this}}}
{{/each}}
{{#if description}}Additional Details: {{{description}}}{{/if}}

Generate the project summary now:
`,
});

const generateProjectSummaryFlow = ai.defineFlow(
  {
    name: 'generateProjectSummaryFlow',
    inputSchema: GenerateProjectSummaryInputSchema,
    outputSchema: GenerateProjectSummaryOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
