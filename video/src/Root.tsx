import React from 'react'
import { Composition } from 'remotion'
import { Main, TOTAL_FRAMES } from './Main'
import { Hook, HOOK_FRAMES } from './scenes/Hook'
import { FleetDeploy, FLEET_FRAMES } from './scenes/FleetDeploy'
import { Resolver, RESOLVER_FRAMES } from './scenes/Resolver'
import { Compare, COMPARE_FRAMES } from './scenes/Compare'
import { Tools, TOOLS_FRAMES } from './scenes/Tools'
import { Close, CLOSE_FRAMES } from './scenes/Close'
import { Anchored, ANCHORED_FRAMES } from './Anchored'
import { DeckFlow, DECKFLOW_FRAMES } from './DeckFlow'
import { CrossSession, CROSS_FRAMES } from './scenes/CrossSession'

const BASE = { width: 1920, height: 1080, fps: 30 } as const

/** Scenes are also registered standalone so a single card can be re-rendered
    without waiting on the full cut. */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="colony8" component={Main} durationInFrames={TOTAL_FRAMES} {...BASE} />
    <Composition id="colony8-anchored" component={Anchored} durationInFrames={ANCHORED_FRAMES} {...BASE} />
    <Composition id="colony8-deck-flow" component={DeckFlow} durationInFrames={DECKFLOW_FRAMES} {...BASE} />
    <Composition id="scene-cross-session" component={CrossSession} durationInFrames={CROSS_FRAMES} {...BASE} />
    <Composition id="scene-hook" component={Hook} durationInFrames={HOOK_FRAMES} {...BASE} />
    <Composition id="scene-fleet" component={FleetDeploy} durationInFrames={FLEET_FRAMES} {...BASE} />
    <Composition id="scene-resolver" component={Resolver} durationInFrames={RESOLVER_FRAMES} {...BASE} />
    <Composition id="scene-compare" component={Compare} durationInFrames={COMPARE_FRAMES} {...BASE} />
    <Composition id="scene-tools" component={Tools} durationInFrames={TOOLS_FRAMES} {...BASE} />
    <Composition id="scene-close" component={Close} durationInFrames={CLOSE_FRAMES} {...BASE} />
  </>
)
