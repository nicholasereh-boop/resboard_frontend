// Ad unit IDs from AdSense (Ads -> By ad unit -> create a "Display ad" -> copy the number in data-ad-slot).
// Leave a value as "" and that ad is simply not shown, so nothing breaks before you have the IDs.
export const AD_CLIENT = "ca-pub-9755138717907134";

// ADSENSE: paste your ad unit numbers here
export const AD_SLOTS = {
  home: "",            // home feed, between the source-code box and the story cards
  homeBottom: "",      // home feed, above "Show me a new set of stories"
  stories: "",         // /stories, between the grid and the page numbers
  storyInline: "",     // story page, after the story text
  storyBottom: "",
  storySideTop: "",    // story page, right-hand side, top card (desktop only)
  storySideBottom: "", // story page, right-hand side, bottom card (desktop only)     // story page, between comments and related stories
  categories: "",      // /categories, under the list
  categoryStories: "", // /categories/:slug (and tags), between the grid and the page numbers

  // ADSENSE (news, public): /news and the news category / search pages. The news article page already uses storyInline,
  // storyBottom and the two side cards above.
  newsHome: "",        // /news, in the grid after the big card
  newsHomeBottom: "",  // /news, under the grid, above "Discover more"
  newsList: "",        // /news/category/:slug and /news/search, between the list and the page numbers

  // ADSENSE (admin, staff only): one bottom ad per admin page. Leave "" to keep a page ad-free.
  adminStoryNew: "",   // /admin/stories/new (add story)
  adminStories: "",    // /admin/stories
  adminComments: "",   // /admin/comments
  adminNews: "",       // /admin/news (the newsroom)
};