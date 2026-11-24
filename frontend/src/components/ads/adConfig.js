// Ad unit IDs from AdSense (Ads -> By ad unit -> create a "Display ad" -> copy the number in data-ad-slot).
// Leave a value as "" and that ad is simply not shown, so nothing breaks before you have the IDs.
export const AD_CLIENT = "ca-pub-9755138717907134";

// ADSENSE: paste your ad unit numbers here
export const AD_SLOTS = {
  home: "",            // home feed, between the source-code box and the story cards
  homeBottom: "",      // home feed, above "Show me a new set of stories"
  stories: "",         // /stories, between the grid and the page numbers
  storyInline: "",     // story page, after the story text
  storyBottom: "",     // story page, between comments and related stories
  categories: "",      // /categories, under the list
  categoryStories: "", // /categories/:slug (and tags), between the grid and the page numbers
};