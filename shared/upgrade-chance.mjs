// The displayed probability and the authoritative roll share this policy.
// Targets in the ×8 range (or above) cannot exceed a 10% success chance.
export function upgradeSuccessChance(stake,price){
 if(!Number.isFinite(stake)||!Number.isFinite(price)||stake<=0||price<=0)return null;
 const raw=stake/price*100;
 if(raw>80+1e-9)return null;
 return price/stake>=7.5?Math.min(10,raw):Math.min(80,raw);
}
