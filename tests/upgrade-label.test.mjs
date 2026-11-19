import test from 'node:test';
import assert from 'node:assert/strict';
import {upgradeChanceLabelScale} from '../client/upgrade-label.mjs';

test('the entire percentage stays in the green triangle on phone and desktop sizes',()=>{
 for(const chance of [1,2,5,10,15,40,80])for(const side of [160,200,260,340]){
  const width=chance===10?29:43,height=14,inset=3;
  const scale=upgradeChanceLabelScale(chance,side,width,height,inset);
  assert.ok(scale>=0&&scale<=1);
  if(scale>0)assert.ok(width*scale+height*scale+2*inset+2<=2*chance/100*side+1e-9);
  if(chance===10)assert.ok(height*scale>=7,'×10 label remains readable even on the smallest square');
 }
});
test('missing geometry never expands a percentage into the red zone',()=>{
 assert.equal(upgradeChanceLabelScale(10,0,40,14),0);
 assert.equal(upgradeChanceLabelScale(NaN,200,40,14),0);
 assert.equal(upgradeChanceLabelScale(10,200,0,0),0);
 assert.equal(upgradeChanceLabelScale(80,300,40,14),1);
});
