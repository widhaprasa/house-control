// The standalone editor has no native device integrations. The real module is used by the
// Mac/iPhone editor; the standalone build aliases this stub in its place, so no connection
// code is shipped with editor.html.
export function createConnections() {
  throw new Error('Connections are not part of the standalone editor');
}
