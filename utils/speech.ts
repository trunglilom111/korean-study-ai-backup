export function getKoreanVoice(): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const voices = window.speechSynthesis.getVoices();

  return (
    voices.find((voice) => voice.lang.toLowerCase().startsWith("ko")) ||
    voices.find((voice) => /korean|hangul|한국/i.test(voice.name))
  );
}

export function speakKorean(
  text: string,
  options?: { rate?: number; onEnd?: () => void; onError?: () => void }
): () => void {
  if (typeof window === "undefined" || !text.trim()) {
    return () => undefined;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text.trim());
  const koreanVoice = getKoreanVoice();

  utterance.lang = "ko-KR";
  utterance.rate = options?.rate ?? 0.9;

  if (koreanVoice) {
    utterance.voice = koreanVoice;
  }

  if (options?.onEnd) {
    utterance.onend = options.onEnd;
  }

  if (options?.onError) {
    utterance.onerror = options.onError;
  }

  window.speechSynthesis.speak(utterance);

  return () => {
    window.speechSynthesis.cancel();
  };
}

export function preloadSpeechVoices(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.speechSynthesis.getVoices();

  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}
