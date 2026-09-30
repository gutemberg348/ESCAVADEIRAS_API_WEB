import { request } from './api'; export const login=(email,password)=>request('/auth/login',{method:'POST',body:JSON.stringify({email,password})});
