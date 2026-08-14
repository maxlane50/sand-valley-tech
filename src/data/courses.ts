/**
 * The only place courses.json is read. Adding or completing a course is a JSON
 * edit — nothing in here needs to change.
 */

import type { Course } from '../scoring/types';
import { assertPlayableCourse, isPlayableCourse } from '../scoring/scoring';
import coursesJson from './courses.json';

export const COURSES: Course[] = coursesJson as Course[];

/** Every course in the file, including stubs that are not filled in yet. */
export function listCourses(): Course[] {
  return COURSES;
}

/** Courses with a complete scorecard, i.e. ones a round can be scored against. */
export function listPlayableCourses(): Course[] {
  return COURSES.filter(isPlayableCourse);
}

/** Looks up a course by id. Throws if the id isn't in courses.json. */
export function getCourse(courseId: string): Course {
  const course = COURSES.find((c) => c.id === courseId);
  if (!course) {
    const known = COURSES.map((c) => c.id).join(', ');
    throw new Error(
      `No course with id "${courseId}" in src/data/courses.json. Known ids: ${known}.`,
    );
  }
  return course;
}

/**
 * Looks up a course and refuses to return it unless it has real data — this is
 * what stops a round from being scored against a stub.
 */
export function getPlayableCourse(courseId: string) {
  return assertPlayableCourse(getCourse(courseId));
}
