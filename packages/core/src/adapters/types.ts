import type { Course } from "../model/course.js";

export interface ParseWarning {
  message: string;
  line?: number;
}

export interface ParseResult {
  courses: Course[];
  /**
   * Anything the adapter could not confidently parse. Surfaced to the user
   * instead of silently dropped, unlike the legacy DSL's empty `catch {}`
   * blocks and no-op fallbacks.
   */
  warnings: ParseWarning[];
}

/**
 * A university adapter turns raw text pasted from that university's course
 * portal into structured courses. This replaces the legacy `.unapp` DSL
 * (instruction.js/text_parser.js): a hand-rolled regex mini-language driven
 * by mutable module-level state (`actual_group`, `actual_schedule`, `stop`,
 * `isLab`...) that could not be unit tested per-university and had already
 * regressed multiple times across the three universities it supported (see
 * the "Temporary fix for unal, this brokes udea" commit in the old repo).
 *
 * Each adapter here is a plain, typed, independently testable function.
 */
export interface UniversityAdapter {
  id: string;
  name: string;
  parse(rawText: string): ParseResult;
}
