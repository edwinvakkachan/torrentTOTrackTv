
import 'dotenv/config';
import pool from "./pool.js";



export async function initDB() {
 
console.log('connected to supabase');


  return pool;
}

