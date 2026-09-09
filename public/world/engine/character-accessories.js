/** Original small carried objects. Grip is the origin; the object hangs below it. */
import * as THREE from 'three'

export function createCharacterAccessory(kind) {
  if(!['records','groceries','parcel'].includes(kind))return null
  const positions=[],normals=[],colors=[]
  function add(geometry,color,x=0,y=0,z=0,rotateZ=0){
    geometry.rotateZ(rotateZ);geometry.translate(x,y,z)
    const mesh=geometry.index?geometry.toNonIndexed():geometry,p=mesh.getAttribute('position'),n=mesh.getAttribute('normal'),c=new THREE.Color(color)
    for(let i=0;i<p.count;i++){positions.push(p.getX(i),p.getY(i),p.getZ(i));normals.push(n.getX(i),n.getY(i),n.getZ(i));colors.push(c.r,c.g,c.b)}
    if(mesh!==geometry)mesh.dispose();geometry.dispose()
  }
  const box=(w,h,d,color,x,y,z=0)=>add(new THREE.BoxGeometry(w,h,d),color,x,y,z)
  function handles(width,depth,color){for(const z of[-depth/2,depth/2]){for(const side of[-1,1])box(.018,.22,.018,color,side*width/2,-.12,z);box(width+.018,.018,.018,color,0,-.009,z)}}
  if(kind==='records'){
    box(.30,.32,.105,'#bbaa79',0,-.38)
    handles(.20,.085,'#716449')
    // A square sleeve protrudes from the canvas opening; it is not a branded cover.
    box(.27,.29,.016,'#334f5a',0,-.33,.009)
    box(.085,.085,.003,'#d7a35e',.04,-.325,-.002)
  }else if(kind==='groceries'){
    box(.28,.34,.18,'#b58b56',0,-.39)
    handles(.16,.13,'#785c39')
    box(.085,.20,.075,'#dee4d0',-.065,-.225,.015)
    add(new THREE.CylinderGeometry(.034,.034,.22,6,1),'#bb7941',.07,-.19,.02,-.12)
  }else{
    box(.34,.23,.25,'#ad7e4b',0,-.115)
    box(.052,.001,.251,'#dcc390',0,-.001)
    box(.052,.231,.001,'#dcc390',0,-.115,.126)
    box(.115,.065,.001,'#e4dec9',.08,-.112,.127)
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeBoundingBox();geometry.computeBoundingSphere()
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92}),mesh=new THREE.Mesh(geometry,material),group=new THREE.Group()
  mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);group.name='character-accessory:'+kind;group.userData.accessory=true;group.userData.kind=kind;group.userData.triangles=positions.length/9
  group.dispose=()=>{geometry.dispose();material.dispose();group.removeFromParent();group.clear()}
  return group
}
