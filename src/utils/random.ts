const sentences: string[] = [
  "人生就像骑自行车，要保持平衡就得往前走。",
  "千里之行，始于足下。",
  "世界那么大，我想去看看。",
  "生活不止眼前的苟且，还有诗和远方。",
  "每一个不曾起舞的日子，都是对生命的辜负。",
  "星光不负赶路人，时光不负有心人。",
  "山重水复疑无路，柳暗花明又一村。",
  "路漫漫其修远兮，吾将上下而求索。",
  "乘风破浪会有时，直挂云帆济沧海。",
  "宝剑锋从磨砺出，梅花香自苦寒来。",
  "The only way to do great work is to love what you do.",
  "Stay hungry, stay foolish.",
  "In the middle of difficulty lies opportunity.",
  "Simplicity is the ultimate sophistication.",
  "Code is like humor. When you have to explain it, it's bad.",
];

/**
 * Get a random sentence from the built-in collection.
 * @returns A random sentence string.
 */
export function getRandomSentence(): string {
  const index = Math.floor(Math.random() * sentences.length);
  return sentences[index];
}
