# TODO

## ambitious plans for later

- native host that can store persistent data
  - seen/hidden posts
  - downloaded posts (deduplication)
    - add options to still show/hide these in results
  - bookmarked page deduplication and retrieval to persist between sessions (fill in bookmark solid color)
- tiktok style feed
- could add 7tv style socials to comments and profiles

## minor bugs

- fix some posts not auto forcing higher quality
- we might be doing too many weird requests causing way worse rate limits. right now we can download a shit ton of posts, but then the backoff will download like 2 every 20 seconds and have to stay at that pace
- default video volume might not be setting unless we have auto play thing on
- handle gateway timeouts also with backoff
- batch download page not displaying the "loading" and checks properly (no checks at all). seems to also be hiding some notifications about what its doing, and when i changed pages and then came back it appeared to not complete the original page, but maybe that was just a rate limit backoff thing
- when i click download all it doesnt mark them as it goes i have to refresh to see updates, also doesnt show queued progress i dont think
- queue stuff is really buggy and broken, ton of edge cases where it will incrememnt left side but not right or increment wrong, i also feel like the persist logic seems wrong because it feels shaky to start downloads and then close tab or switch pages
- bug on accounts like dagasi post page first image which is advertisement gets the hover stuff not the real post

## minor features

- hotkeys for next/last page
- for posts that have parent/child posts, add a "download collection" button (should go in order)
- enable option for thumbnail size label to show the true underlying media dimensions and not just the preview
- ability to turn off/on notification/other sounds at fine grain
- in extension popup dont show downloads unless on rule34.xxx in relevant apage
- cleanup the layout of the extension options page, some things like auto pause should be in the same section as auto play videos on post pages
- easily bookmark actual posts for later from hover
- starred/hearted tags/artists,etc
- settings icon in top bar or sidebar to bring to extension settings
- hide tag search previous/next
  - add keyboard shortcuts for them
- force always view original (private browsing makes you reset usually)
- enhanced sorting
  - easy score filtering
  - arrow flip flop up down for recency
  - might be configurable in settings
- saved searches in dropdown filter list
  - need to wait for sqlite for this
- optionally show score on hover
- make some of the options for hover just be permentant (ytou can choose for each thing to be either off, hover, always on)
- condense settings and give it a pass to make some things that are implicitely done now into settings
- pretty console printout of rule34 tools ascii logo with version.
- track saved pages (not just tags, this works for searches)
- introduce actions tracking (times downloaded, times seen post, pages saved, videos played, pages visited, times expanded posts, searches, can see stuff over time as well)
- heart tags and artists. "follow" artists and there is a following feed that displays only things tagged by artists you follow
- when you focus tab, re-check all of the saved post and tag bookmarks to update visually (could have changed in other tabs)

## abstract ideas

- introduce R34 API to potentially be more efficient (not scraping site to reduce load)
- experiment with rate limit bypassing or techniques that make it faster/more efficient
