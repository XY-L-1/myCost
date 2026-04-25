import { create } from "zustand";
import { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import { prepareSupabaseAuthStorage } from "./authStorage";

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
   signIn: (email: string, password: string) => Promise<void>;
   signUp: (email: string, password: string) => Promise<void>;
   signOut: () => Promise<void>;
};

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
      try {
         await prepareSupabaseAuthStorage();

         if (!isSupabaseConfigured) {
            set({
               session: null,
               user: null,
               initializing: false,
            });
            return;
         }

         const { data, error } = await supabase.auth.getSession();
         if (error) {
            throw error;
         }

         set({
            session: data.session,
            user: data.session?.user ?? null,
            initializing: false,
         });

         supabase.auth.onAuthStateChange((_event, session) => {
            set({
               session,
               user: session?.user ?? null,
               initializing: false,
            });
         });
      } catch (error) {
         console.error("[AUTH] initialization failed", error);
         set({
            session: null,
            user: null,
            initializing: false,
         });
      }
   },

   /**
      * signIn
      *
      * Alias for email/password sign-in used by UI screens.
      */
   signIn: async (email, password) => {
      if (!isSupabaseConfigured) {
         throw new Error("Cloud sync is not configured for this build.");
      }

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

   },

   /**
      * signUp
      *
      * Creates a new account. Session is not set until user verifies email.
      */
   signUp: async (email, password) => {
      if (!isSupabaseConfigured) {
         throw new Error("Cloud sync is not configured for this build.");
      }

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
