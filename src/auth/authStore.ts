import { create } from "zustand";
import { createClient, Session, User } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { attachAnonymousDataToUser } from "../services/loginMergeService";
import { supabase } from "./supabaseClient";

/**
 * AuthState
 *
 * Centralizes authentication state.
 * This store does NOT store any business data.
 */
type AuthState = {
   user: User | null;
   session: Session | null;
   initializing: boolean;

   initialize: () => Promise<void>;
   signInWithEmail: (email: string, password: string) => Promise<void>;
   signIn: (email: string, password: string) => Promise<void>;
   signUp: (email: string, password: string) => Promise<void>;
   signOut: () => Promise<void>;
};

// const supabase = createClient(
//    process.env.EXPO_PUBLIC_SUPABASE_URL!,
//    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
//    {
//       auth: {
//          storage: {
//          getItem: SecureStore.getItemAsync,
//          setItem: SecureStore.setItemAsync,
//          removeItem: SecureStore.deleteItemAsync,
//          },
//          persistSession: true,
//       },
//    }
// );

export const useAuthStore = create<AuthState>((set) => ({
   user: null,
   session: null,
   initializing: true,

   /**
      * initialize
      *
      * Restores persisted auth session from SecureStore.
      * This runs once at app startup.
      */
   initialize: async () => {
      const { data } = await supabase.auth.getSession();
      set({
         session: data.session,
         user: data.session?.user ?? null,
         initializing: false,
      });
   },

   /**
      * signInWithEmail
      *
      * Logs in the user and updates auth state.
      */
   signInWithEmail: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({
         email,
         password,
      });

      if (error) {
         throw error;
      }

      set({
         session: data.session,
         user: data.user,
      });

      // Attach anonymous local data
      await attachAnonymousDataToUser(data.user.id);
   },

   /**
      * signIn
      *
      * Alias for email/password sign-in used by UI screens.
      */
   signIn: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({
         email,
         password,
      });

      if (error) {
         throw error;
      }

      set({
         session: data.session,
         user: data.user,
      });

      // Attach anonymous local data
      await attachAnonymousDataToUser(data.user.id);
   },

   /**
      * signUp
      *
      * Creates a new account. Session is not set until user verifies email.
      */
   signUp: async (email, password) => {
      const { error } = await supabase.auth.signUp({
         email,
         password,
      });

      if (error) {
         throw error;
      }
   },

   /**
      * signOut
      *
      * Logs out the user and clears auth state.
      * Local SQLite data is NOT deleted.
      */
   signOut: async () => {
      await supabase.auth.signOut();
      set({
         session: null,
         user: null,
      });
  },
}));
