import {createHash} from 'node:crypto';

// Owner approved for editorial access. This is an identifier, never a password.
// The email must come from Firebase's verified account lookup, not request data.
const OWNER_EMAIL_HASH='ba01f0f954f366b47485721a7b3bce4485e1e19fb14e86d9c4de7baff3102c78';
export function isAdministrator(user){
  if(user?.emailVerified!==true||typeof user.email!=='string')return false;
  return createHash('sha256').update(user.email.trim().toLowerCase()).digest('hex')===OWNER_EMAIL_HASH;
}
export function adminMembership(){
  return {role:'admin',canPlay:true,ownAccess:true,checkoutAvailable:false,hasCustomer:false,
    calendar:{available:12,released:12,claimed:[],nextAt:null},periodEnd:null};
}
