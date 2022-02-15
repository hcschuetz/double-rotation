TODO:
- Make documentation scrollable
  (How to size the scroll box?)
- Support hiding the config
  - Using `<details>`/`<summary>` or some React component?
    (Should the hide/show state go to the URL?)
  - How to get this good-looking?
  - Or just scroll the config together with the documentation?
- We might store the options in the query/search part instead of the hash
  part of the URL.
  The advantage would be that the hash would still be available for actual
  navigation within the page.
  The disadvantage would be that a plain link with a new query/search part
  would open a new document.
  (For JS-generated option changes we could stay in the same document by using
  "pushState" instead of updating "window.location".
  We could also use "pseudo links" that actually call JS code upon a click,
  but then browser functionality like "open link in new window" would no more
  work.)
  See also here:
  https://developer.mozilla.org/en-US/docs/Web/API/History/pushState#description
