-- Option 1: Update a specific company by ID
-- Replace 'YOUR_COMPANY_ID' with the actual company ID
UPDATE companies
SET default_terms_and_conditions = '1. Payment terms:
    50% Advance
    40% As progressive
    10% Upon completion

2. Scope of work:
    As outlined in the specifications, drawings and clients instructions
    Any changes/alterations to the scope of work outlined will affect the final quantity will be measures, and changes will be applied on a pro-rata basis at the agreed rate
    We are not responsible for any damages caused by negligence from other sub-contractors hired by the client

3. General: Excludes statutory fees, public liability insurance, and other items not mentioned.

4. Warranty: As per contract terms and conditions.

5. Acceptance of Quote: Acceptance is confirmed when the client signs a copy of this document and returns a copy to us.

6. Validity: This quotation is valid for 14 days from the date of issue.'
WHERE id = 'YOUR_COMPANY_ID';

-- Option 2: Update all companies with these default terms
-- Uncomment the line below if you want to set these terms for all companies
-- UPDATE companies
-- SET default_terms_and_conditions = '1. Payment terms:
--     50% Advance
--     40% As progressive
--     10% Upon completion
-- 
-- 2. Scope of work:
--     As outlined in the specifications, drawings and clients instructions
--     Any changes/alterations to the scope of work outlined will affect the final quantity will be measures, and changes will be applied on a pro-rata basis at the agreed rate
--     We are not responsible for any damages caused by negligence from other sub-contractors hired by the client
-- 
-- 3. General: Excludes statutory fees, public liability insurance, and other items not mentioned.
-- 
-- 4. Warranty: As per contract terms and conditions.
-- 
-- 5. Acceptance of Quote: Acceptance is confirmed when the client signs a copy of this document and returns a copy to us.
-- 
-- 6. Validity: This quotation is valid for 14 days from the date of issue.';
