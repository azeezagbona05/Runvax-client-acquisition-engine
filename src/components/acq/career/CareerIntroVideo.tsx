'use client';

import IntroVideo from '../IntroVideo';

export const CAREER_INTRO_ID = 'career-agent';
export default function CareerIntroVideo() {
  return <IntroVideo id={CAREER_INTRO_ID} title="Meet the Career Agent" blurb="A short demo: upload your CV, find jobs, and approve applications." src="/welcome/runvax-career-agent-demo.mp4" poster="/welcome/career-poster.jpg" />;
}
