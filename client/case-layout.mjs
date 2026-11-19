// Compute only the space actually covered by a visible left-docked feed.
export function caseLiveInset(viewport,rail,visible,compact=false){
 if(compact||!visible||!rail||!viewport||viewport.width<=0||rail.width<=0||rail.width>=viewport.width/2||rail.left>viewport.left+12||rail.right<=viewport.left)return 0;
 return Math.max(0,Math.min(Math.ceil(rail.right-viewport.left),Math.max(0,viewport.width-240)));
}
