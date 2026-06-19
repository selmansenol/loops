-- Idempotent functions, triggers and indexes that Drizzle's schema can't express.
-- Re-run safe: every statement uses CREATE OR REPLACE / IF NOT EXISTS / DROP IF EXISTS.
-- Supabase-specific concerns (RLS, role GRANTs, auth.users trigger, pg_net webhook
-- dispatch) are intentionally NOT here — authorization and webhook delivery moved
-- into the application layer.

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), gen_random_bytes()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- trigram search indexes

-- ============================================================
-- updated_at maintenance
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS posts_set_updated_at ON public.posts;
CREATE TRIGGER posts_set_updated_at BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS webhooks_updated_at ON public.webhooks;
CREATE TRIGGER webhooks_updated_at BEFORE UPDATE ON public.webhooks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS comments_set_updated_at ON public.comments;
CREATE TRIGGER comments_set_updated_at BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- votes_count kept in sync with the votes table
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_vote_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET votes_count = votes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET votes_count = GREATEST(votes_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS votes_after_insert ON public.votes;
CREATE TRIGGER votes_after_insert AFTER INSERT ON public.votes
  FOR EACH ROW EXECUTE FUNCTION public.handle_vote_change();

DROP TRIGGER IF EXISTS votes_after_delete ON public.votes;
CREATE TRIGGER votes_after_delete AFTER DELETE ON public.votes
  FOR EACH ROW EXECUTE FUNCTION public.handle_vote_change();

-- ============================================================
-- shipped_at auto-fill when a post is marked done
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_post_shipped()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    NEW.shipped_at = now();
  ELSIF NEW.status <> 'done' THEN
    NEW.shipped_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_set_shipped_at ON public.posts;
CREATE TRIGGER posts_set_shipped_at
  BEFORE UPDATE OF status ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_post_shipped();

-- ============================================================
-- Trigram search indexes for board search
-- ============================================================
CREATE INDEX IF NOT EXISTS posts_title_trgm_idx
  ON public.posts USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS posts_description_trgm_idx
  ON public.posts USING gin (description gin_trgm_ops);
