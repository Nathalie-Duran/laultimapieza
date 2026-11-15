import {createHash} from 'node:crypto';

// Approved accounts for editorial access. These are identifiers, never passwords.
// The email must come from Firebase's verified account lookup, not request data.
const ADMIN_EMAIL_HASHES=new Set(['ba01f0f954f366b47485721a7b3bce4485e1e19fb14e86d9c4de7baff3102c78','f7b13ea9c8f759204dbe3c6bea6894beeb71ae834551295233bd84f098dcb28e']);
export function isAdministrator(user){
  if(user?.emailVerified!==true||typeof user.email!=='string')return false;
  return ADMIN_EMAIL_HASHES.has(createHash('sha256').update(user.email.trim().toLowerCase()).digest('hex'));
}
export function adminMembership(){
  return {role:'admin',canPlay:true,ownAccess:true,checkoutAvailable:false,hasCustomer:false,
    calendar:{available:12,released:12,claimed:[],nextAt:null},periodEnd:null};
}
