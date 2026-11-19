var CASE_LAYOUT_FRAME=0,CASE_LAYOUT_ROOT=null,CASE_LAYOUT_RAIL=null,CASE_LAYOUT_RESIZE=null,CASE_LAYOUT_MUTATION=null;
function syncCaseLiveSpace(){
 var root=CW.el,box=document.getElementById('cw-box'),rail=document.getElementById('bu-live');if(!root||!box)return;
 var rect=root.getBoundingClientRect(),railRect=rail&&rail.getBoundingClientRect(),style=rail&&window.getComputedStyle(rail),visible=!!(rail&&root.contains(rail)&&!rail.hidden&&style.display!=='none'&&style.visibility!=='hidden'&&railRect.height>0);
 var inset=caseLiveInset(rect,railRect,visible,window.matchMedia('(max-width:992px)').matches),value=inset+'px';
 if(root.style.getPropertyValue('--case-live-space')!==value)root.style.setProperty('--case-live-space',value);
 if(CASE_LAYOUT_ROOT!==root||CASE_LAYOUT_RAIL!==rail){
  if(CASE_LAYOUT_RESIZE)CASE_LAYOUT_RESIZE.disconnect();if(CASE_LAYOUT_MUTATION)CASE_LAYOUT_MUTATION.disconnect();CASE_LAYOUT_ROOT=root;CASE_LAYOUT_RAIL=rail;
  if(typeof ResizeObserver==='function'){CASE_LAYOUT_RESIZE=new ResizeObserver(scheduleCaseLiveSpace);CASE_LAYOUT_RESIZE.observe(root);if(rail)CASE_LAYOUT_RESIZE.observe(rail)}
  if(typeof MutationObserver==='function'){CASE_LAYOUT_MUTATION=new MutationObserver(scheduleCaseLiveSpace);CASE_LAYOUT_MUTATION.observe(root,{attributes:true,attributeFilter:['class']});if(rail)CASE_LAYOUT_MUTATION.observe(rail,{attributes:true,attributeFilter:['class','style','hidden']})}
 }
}
function scheduleCaseLiveSpace(){if(CASE_LAYOUT_FRAME)return;CASE_LAYOUT_FRAME=requestAnimationFrame(function(){CASE_LAYOUT_FRAME=0;syncCaseLiveSpace()})}
var renderBeforeMeasuredCaseLayout=cwRender;cwRender=function(){var result=renderBeforeMeasuredCaseLayout.apply(this,arguments);syncCaseLiveSpace();scheduleCaseLiveSpace();return result};
var liveBeforeMeasuredCaseLayout=updateCaseLiveDrops;updateCaseLiveDrops=function(){var result=liveBeforeMeasuredCaseLayout.apply(this,arguments);scheduleCaseLiveSpace();return result};
window.addEventListener('resize',scheduleCaseLiveSpace,{passive:true});
