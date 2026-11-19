// In the top-right green triangle, a horizontal label fits when width + height
// is at most twice the chance fraction of the square. Never enlarge the zone.
export function upgradeChanceLabelScale(chance, side, width, height, inset=3){
 if(![chance,side,width,height].every(Number.isFinite)||chance<=0||side<=0||width+height<=0)return 0;
 return Math.max(0,Math.min(1,(2*chance/100*side-2*inset-2)/(width+height)));
}
