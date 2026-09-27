/**
 * app/page.tsx  (updated)
 *
 * The page is a Server Component — it renders NauticEyeConsole with the
 * static demo dataset so the page is instantly interactive with no loading
 * state on first paint.
 *
 * NauticEyeConsole itself is now a Client Component that calls
 * useLiveVessels() to swap in real AIS data once available.
 */

import { NauticEyeConsole } from '@/components/nauticeye/console'
import { getDemonstrationDataset } from '@/lib/nauticeye/data-source'

export default function Page() {
  return (
    <>
      <noscript>
        <div className="noscript-notice">
          NauticEye maritime intelligence is available without JavaScript.{' '}
          <a href="/lite">Open the lightweight console →</a>
        </div>
      </noscript>
      {/*
        Pass the demo dataset as the initial prop.
        The console will replace vessels with live AIS data once it loads.
        This means users see the map immediately — no blank screen.
      */}
      <NauticEyeConsole dataset={getDemonstrationDataset()} />
    </>
  )
}
