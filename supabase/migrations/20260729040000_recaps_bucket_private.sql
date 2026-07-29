-- Make the recaps storage bucket PRIVATE.
-- App access uses service-role + createSignedUrl (signedRecapUrl); no public read.

update storage.buckets
set public = false
where id = 'recaps';

drop policy if exists recaps_public_read on storage.objects;
