# Live UI preview

`index.html` is a single self-contained page that runs Aida's interface with no
build step and no server: open it in a browser and it works.

It is published at
<https://claude.ai/code/artifact/8d86ce46-ceab-4132-8eb6-978644920bdf>.

Streaming, the stop button, conversation persistence, markdown rendering and
the settings sheet all behave as they do in the real app. What it cannot do is
call a model — a published page may not make network requests — so answers come
from a script written from this repository's documentation. Ask it how to run
the app, how streaming works, what the API looks like, how the model layer
handles effort and thinking, or how the project is laid out.

It shares the React app's design tokens, so it is also a quick way to check a
palette or type change without starting the dev servers.
