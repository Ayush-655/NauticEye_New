import { NauticEyeConsole } from '@/components/nauticeye/console'
import { getDemonstrationDataset } from '@/lib/nauticeye/data-source'

export default function Page() {
  return <>
    <noscript><div className="noscript-notice">NauticEye maritime intelligence is available without JavaScript. <a href="/lite">Open the lightweight console →</a></div></noscript>
    <NauticEyeConsole dataset={getDemonstrationDataset()} />
  </>
}
