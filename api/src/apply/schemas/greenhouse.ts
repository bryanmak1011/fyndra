import { assertAllowedHost, politeFetchJson } from '../../sourcing/provider.js';

// Greenhouse is the only ATS with a genuinely public, unauthenticated
// form-schema API — see BLOCKERS.md 2026-09-01 and apply-route.ts for why
// Lever/Ashby/Workable readers are NOT implemented alongside this one.
const ALLOWED_HOSTS = new Set(['boards-api.greenhouse.io']);

export interface FormFieldOption {
  label: string;
  value: string | number;
}

export interface FormField {
  /** The field name to submit against, e.g. "question_36101209002". */
  name: string;
  /** Greenhouse's own type — input_text, input_file, multi_value_single_select, etc. */
  type: string;
  /** Select-type options, named `values` to match Greenhouse's actual wire format exactly. */
  values: FormFieldOption[];
}

export interface FormQuestion {
  label: string;
  required: boolean;
  fields: FormField[];
}

interface GreenhouseJobDetail {
  questions: FormQuestion[];
}

/**
 * Fetches the real, structured application-form schema for one Greenhouse
 * job — every question, its required flag, and (for select-type fields)
 * the exact option values the ATS expects. `prefill.ts` (T065) maps
 * profile/CV data onto this; `sensitive.ts` (T063) classifies each
 * `label` before anything is auto-filled.
 */
export async function fetchGreenhouseFormSchema(boardToken: string, jobId: string): Promise<FormQuestion[]> {
  const url = assertAllowedHost(
    `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs/${jobId}?questions=true`,
    ALLOWED_HOSTS,
  );
  const { questions } = await politeFetchJson<GreenhouseJobDetail>(url);
  return questions;
}

/** Pulls the numeric Greenhouse job id out of an absolute_url like
 * https://job-boards.greenhouse.io/{board}/jobs/{id}. */
export function extractGreenhouseJobId(employerApplyUrl: string): string | null {
  const match = employerApplyUrl.match(/\/jobs\/(\d+)/);
  return match ? match[1] : null;
}
