// A made-up edition for public tests. All names, answers, recordings and room IDs are test data.
const roles=['A','B'];
const roomIds=Array.from({length:8},(_,index)=>'room-'+(index+1));
const steps=[1,2,3,4,6,8,9,11];
const evidence=name=>roles.map(role=>({role,title:'Observation '+name+' '+role,text:'Sample observation '+name+' from room '+role+'.'}));
const code={id:'token',label:'Test token',type:'code',maxLength:30};
const levels=Array.from({length:15},(_,index)=>{
  const n=index+1;
  return {room:roomIds[steps.findLastIndex(first=>first<=n)],title:'Mechanism '+n,brief:'Try mechanism '+n,
    evidence:evidence(n),controls:[code],solution:{token:'test-'+n}};
});
levels[2].actions=[
  {id:'pick-a',label:'Take left strip',role:'A',give:'left'},
  {id:'pick-b',label:'Take right strip',role:'B',give:'right'},
  {id:'join',label:'Join the strips',role:'both',needs:['left','right'],take:['left','right'],give:'pair'}
];
levels[2].requires=['join'];
levels[14].controls=[
  {id:'panel',label:'Side',type:'select',options:roles.map(role=>({value:role,label:'Side '+role}))},
  {id:'secuencia',label:'Panel token',type:'code',maxLength:10}
];
delete levels[14].solution;
const questIds=['nox','diario','jardin','puerta'];
const sideQuests=questIds.map((id,index)=>({
  id,title:'Side quest '+index,brief:'Sample optional task',room:roomIds[index],min:[2,4,8,11][index],
  evidence:evidence(id),controls:[code],solution:{token:'test-'+id},album:{id,title:'Sample reward '+index,text:'Sample result'}
}));
const recordings=Object.fromEntries(['carta','radio','final'].map(id=>[id,{title:'Recording '+id,text:'Transcript '+id,audio:'/test-'+id+'.wav'}]));
export const mansionFixture={
  version:1,title:'Sample episode',chapters:['One','Two','Three','Four','Five'],
  letterEntry:{id:'note',title:'Letter',text:'Sample introduction'},
  endingEntries:[{id:'one',title:'Specimen one',text:'First sample'},{id:'two',title:'Specimen two',text:'Second sample'}],
  conclusion:{title:'Test ending',text:'The sample investigation has ended.'},recordings,
  panelAnswers:{A:'test-A',B:'test-B'},panelHints:{A:'sample help A',B:'sample help B'},
  objects:{left:['Left strip','A'],right:['Right strip','B'],pair:['Joined strips','both']},
  rooms:roomIds.map((id,i)=>[id,'Room '+(i+1),steps[i],'Sample location A','Sample location B']),
  levels,hints:levels.map((_,i)=>['Sample first hint '+i,'Sample second hint '+i]),
  explanations:levels.slice(0,14).map((_,i)=>'Sample explanation '+i),sideQuests
};
