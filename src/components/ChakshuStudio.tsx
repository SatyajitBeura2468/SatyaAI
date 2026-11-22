import React from "react";
import { Download, Square, Video as VideoIcon } from "lucide-react";
import { DRISHTI_COMPANION_INSTALL_URL, type DrishtiModelAvailability, type DrishtiRuntimeHealth } from "../ai/drishti/client";
import type { ChakshuRuntimeStatus } from "../ai/chakshu/client";
import { getChakshuModel, type ChakshuModel } from "../ai/chakshu/registry";
import type { ChakshuHistoryItem } from "../ai/chakshu/history";
import { CHAKSHU_IDEA_COPY, CHAKSHU_STUDIO_HEADLINES, pickOnLoad } from "../ui-copy";

const CHAKSHU_HEADLINE = pickOnLoad(CHAKSHU_STUDIO_HEADLINES);
const CHAKSHU_IDEAS = pickOnLoad(CHAKSHU_IDEA_COPY);

type ChakshuStudioProps = {
  drishtiChecking: boolean;
  drishtiStarting: boolean;
  drishtiRuntimeHealth: DrishtiRuntimeHealth | null;
  drishtiWindowsDesktopSupported: boolean;
  connectChakshuRuntime: () => void;
  chakshuGenerating: boolean;
  currentChakshu: ChakshuModel;
  chakshuModelId: ChakshuHistoryItem["model_id"];
  divyaLicenseAccepted: boolean;
  setDivyaLicenseAccepted: React.Dispatch<React.SetStateAction<boolean>>;
  chakshuResult: (ChakshuHistoryItem & { video_url: string }) | null;
  chakshuHistory: Array<ChakshuHistoryItem & { video_url: string }>;
  chakshuActiveHistoryId: string | null;
  selectChakshuHistory: (item: ChakshuHistoryItem & { video_url: string }) => void;
  chakshuHistoryWarning: string;
  chakshuError: string;
  chakshuRuntimeStatus: ChakshuRuntimeStatus | null;
  stopChakshuGeneration: () => void;
  chakshuModelRuntime: DrishtiModelAvailability | undefined;
  pickSuggestion: (prompt: string) => void;
};

export function ChakshuStudio(props: ChakshuStudioProps) {
  const {
    drishtiChecking, drishtiStarting, drishtiRuntimeHealth, drishtiWindowsDesktopSupported,
    connectChakshuRuntime, chakshuGenerating, currentChakshu, chakshuModelId,
    divyaLicenseAccepted, setDivyaLicenseAccepted, chakshuResult, chakshuHistory,
    chakshuActiveHistoryId, selectChakshuHistory, chakshuHistoryWarning, chakshuError,
    chakshuRuntimeStatus, stopChakshuGeneration, chakshuModelRuntime, pickSuggestion,
  } = props;
  return (
      <div className="drishti-studio chakshu-studio" aria-label="Chakshu video workspace">
                    <div className="drishti-studio-mark" aria-hidden="true"><VideoIcon size={31} strokeWidth={1.6} /></div>
                    <div className="drishti-studio-copy">
                      <span className="drishti-kicker">SATYAAI · CHAKSHU VIDEO STUDIO</span>
                      <h1>{CHAKSHU_HEADLINE.lead} <em>{CHAKSHU_HEADLINE.accent}</em></h1>
                      <p>{drishtiChecking ? "Checking the local creative engine…" : drishtiRuntimeHealth ? "Chakshu is connected on " + (drishtiRuntimeHealth.device_name || drishtiRuntimeHealth.device) + ". Video weights download only when a tier is first used." : "Create videos locally on a Windows desktop with Chakshu. Phones, macOS and Linux are not supported yet."}</p>
                      {!drishtiWindowsDesktopSupported && (
                        <div className="drishti-platform-note" role="note">
                          <strong>Windows desktop required</strong>
                          <span>Chakshu's local video engine currently runs through the SatyaAI Windows companion. Open SatyaAI on a Windows PC to generate video.</span>
                        </div>
                      )}
                      <div className="drishti-connect-actions">
                        <button type="button" className="drishti-connect-primary" onClick={() => void connectChakshuRuntime()} disabled={!drishtiWindowsDesktopSupported || drishtiChecking || drishtiStarting || chakshuGenerating}>
                          {drishtiStarting ? "Starting…" : drishtiRuntimeHealth ? "Recheck local engine" : "Start local engine"}
                        </button>
                        {!drishtiRuntimeHealth && drishtiWindowsDesktopSupported && <a className="drishti-install-link" href={DRISHTI_COMPANION_INSTALL_URL} target="_blank" rel="noreferrer">Install companion once</a>}
                      </div>
                    </div>
                    {!chakshuGenerating && !drishtiStarting && !chakshuResult && !chakshuError && (
                      <>
                        <div className="drishti-ideas-heading">
                          <div>
                            <strong>{CHAKSHU_IDEAS.title}</strong>
                            <span>{CHAKSHU_IDEAS.subtitle}</span>
                          </div>
                          <span className="drishti-ideas-sparkle" aria-hidden="true"><VideoIcon size={17} /></span>
                        </div>
                        <div className="drishti-ideas-grid chakshu-ideas-grid">
                          {[
                            { icon: "✦", title: "Cinematic landscapes", description: "A sweeping sunrise over a mountain range", prompt: "A cinematic aerial establishing shot over a dramatic Himalayan mountain range at sunrise, clouds flowing through deep valleys, golden light slowly illuminating the snow-covered peaks, smooth forward drone movement, realistic natural cinematography." },
                            { icon: "◉", title: "Nature in motion", description: "A hummingbird hovering beside a flower", prompt: "An ultra-detailed macro nature film of a hummingbird hovering beside a bright tropical flower, delicate wing movement, tiny droplets catching the morning light, soft bokeh background, gentle slow-motion camera movement, photorealistic." },
                            { icon: "◇", title: "Future city", description: "A quiet flight through a luminous skyline", prompt: "A cinematic continuous camera flight through a futuristic coastal city at blue hour, elegant illuminated towers, elevated transit gliding between buildings, reflections across rain-wet streets, atmospheric depth, smooth forward camera motion." },
                            { icon: "▧", title: "Product reveal", description: "A premium object turning in studio light", prompt: "A premium cinematic product reveal of a fictional brushed-titanium wristwatch on a dark reflective plinth, slow controlled orbiting camera, precise moving highlights across the metal, deep navy studio background, photorealistic commercial lighting." },
                          ].map((idea) => (
                            <button key={idea.title} type="button" className="drishti-idea-card" onClick={() => pickSuggestion(idea.prompt)} disabled={chakshuGenerating || drishtiStarting || !drishtiWindowsDesktopSupported}>
                              <span className="drishti-idea-icon" aria-hidden="true">{idea.icon}</span>
                              <span className="drishti-idea-text"><strong>{idea.title}</strong><small>{idea.description}</small></span>
                              <span className="drishti-idea-arrow" aria-hidden="true">↗</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    {chakshuModelId === "divya" && (
                      <div className="chakshu-license">
                        <label><input type="checkbox" checked={divyaLicenseAccepted} onChange={(event) => setDivyaLicenseAccepted(event.target.checked)} /><span>I have reviewed and agree to the LTX-2.x Community License for the Divya Chakshu 1 model weights.</span></label>
                        <a href="https://huggingface.co/Lightricks/LTX-2.5-Diffusers/blob/main/LICENSE" target="_blank" rel="noreferrer">Read the model licence</a>
                      </div>
                    )}
                    {chakshuResult && (
                      <div className="drishti-result chakshu-result">
                        <video src={chakshuResult.video_url} controls playsInline preload="metadata" aria-label={"Video generated by Chakshu: " + chakshuResult.prompt} />
                        <div className="drishti-result-prompt"><strong>Prompt</strong><p>{chakshuResult.prompt}</p></div>
                        <div className="drishti-result-footer">
                          <span>{getChakshuModel(chakshuResult.model_id).name} · Generated locally · {chakshuResult.elapsed_seconds}s · Seed {chakshuResult.seed}</span>
                          <a className="drishti-download" href={chakshuResult.video_url} download={"satyaai-chakshu-" + chakshuResult.seed + ".mp4"}><Download size={15} /> Download MP4</a>
                        </div>
                      </div>
                    )}
                    {chakshuHistory.length > 0 && (
                      <div className="drishti-history">
                        <div className="drishti-history-heading"><strong>Recent videos</strong><span>Saved in this browser · {chakshuHistory.length}</span></div>
                        <div className="drishti-history-grid">
                          {chakshuHistory.map((item) => (
                            <button key={item.id} type="button" className={"drishti-history-item" + (chakshuActiveHistoryId === item.id ? " active" : "")} onClick={() => selectChakshuHistory(item)} aria-pressed={chakshuActiveHistoryId === item.id} title={item.prompt}>
                              <video src={item.video_url} muted playsInline preload="metadata" />
                              <span>{item.prompt}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {chakshuHistoryWarning && <div className="drishti-history-warning">{chakshuHistoryWarning}</div>}
                    {chakshuError && <div className="drishti-runtime-error" role="alert">{chakshuError}</div>}
                    {(drishtiStarting || chakshuGenerating) && (
                      <div className="drishti-loading-card" role="status" aria-live="polite">
                        <div className="drishti-loading-head"><strong>{drishtiStarting ? "Starting the local video engine" : chakshuRuntimeStatus?.phase === "loading_model" ? "Preparing the selected video model" : "Rendering your video"}</strong><span>{chakshuRuntimeStatus?.progress != null ? chakshuRuntimeStatus.progress + "%" : "Working"}</span></div>
                        <div className={"drishti-progress-track" + (chakshuRuntimeStatus?.progress == null ? " indeterminate" : "")}><span style={chakshuRuntimeStatus?.progress != null ? { width: chakshuRuntimeStatus.progress + "%" } : undefined} /></div>
                        <small>{drishtiStarting ? "Waking the installed companion and checking this computer…" : chakshuRuntimeStatus?.message || "Downloading the selected weights if needed, then generating locally…"}</small>
                        <button type="button" className="drishti-cancel-button" onClick={stopChakshuGeneration}><Square size={13} /> Stop generation</button>
                      </div>
                    )}
                    <div className="drishti-studio-note" role="status" aria-live="polite">
                      {drishtiStarting ? "The desktop companion is starting. Your video prompt is sent only after the local health check succeeds."
                        : drishtiChecking ? "Checking local video model availability…"
                        : drishtiRuntimeHealth ? chakshuModelRuntime?.available
                          ? chakshuModelId === "divya" && !divyaLicenseAccepted ? "Review the LTX-2.x Community License and tick the acknowledgement before generating."
                            : "Local runtime ready for this tier. Your prompt is sent only to this device."
                          : chakshuModelRuntime?.reason || "This video model is not available on the detected hardware."
                        : "First install the updated companion once. It prepares its private runtime and caches selected model weights on first use."}
                    </div>
                  </div>
  );
}
