/**
 * The sentences the practice offers, until the real set is extracted from
 * the blog (SPEC §6.4, phase 2). Each has the text as shown and its
 * reading in kana, which is what the romaji is made from; the tags say
 * which keys a sentence needs, so a guide step can pick sentences typed
 * on the keys decided so far.
 */
export type TextTag = "base" | "symbols" | "digits" | "en";

export interface PracticeText {
  id: string;
  display: string;
  kana: string;
  tags: TextTag[];
}

export const TEXTS_JA: PracticeText[] = [
  {
    id: "ja-1",
    display: "よく使うキーから順に置いていく",
    kana: "よくつかうきーからじゅんにおいていく",
    tags: ["base"],
  },
  {
    id: "ja-2",
    display: "親指でスペースを押す場所を決める",
    kana: "おやゆびですぺーすをおすばしょをきめる",
    tags: ["base"],
  },
  {
    id: "ja-3",
    display: "記号はハイフンとコロンを入れ替えた",
    kana: "きごうははいふんところんをいれかえた",
    tags: ["base"],
  },
  {
    id: "ja-4",
    display: "キーマップは使いながら少しずつ直していけばいい",
    kana: "きーまっぷはつかいながらすこしずつなおしていけばいい",
    tags: ["base"],
  },
  {
    id: "ja-5",
    display: "レイヤーキーは親指のホームポジション近くに置く",
    kana: "れいやーきーはおやゆびのほーむぽじしょんちかくにおく",
    tags: ["base"],
  },
  {
    id: "ja-6",
    display: "自作キーボードは、用途に合わせて配列を変えてこそ本領を発揮する。",
    kana: "じさくきーぼーどは、ようとにあわせてはいれつをかえてこそほんりょうをはっきする。",
    tags: ["base", "symbols"],
  },
  {
    id: "ja-7",
    display: "一つのレイヤーが完成したら、次へ進む前に練習する",
    kana: "ひとつのれいやーがかんせいしたら、つぎへすすむまえにれんしゅうする",
    tags: ["base", "symbols"],
  },
  {
    id: "ja-8",
    display: "右手だけでカーソルを動かし、左手だけで記号を打つ",
    kana: "みぎてだけでかーそるをうごかし、ひだりてだけできごうをうつ",
    tags: ["base", "symbols"],
  },
  {
    id: "ja-9",
    display: "2026年10月17日にキーテストを公開した",
    kana: "2026ねん10がつ17にちにきーてすとをこうかいした",
    tags: ["base", "digits"],
  },
  {
    id: "en-1",
    display: "keeb-on.studio/practice",
    kana: "keeb-on.studio/practice",
    tags: ["en", "symbols"],
  },
  {
    id: "en-2",
    display: "Hold the layer key, then press the arrow keys.",
    kana: "Hold the layer key, then press the arrow keys.",
    tags: ["en", "symbols"],
  },
];
