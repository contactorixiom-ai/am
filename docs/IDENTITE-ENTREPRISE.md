# Identité de l'entreprise sur les documents — à renseigner

## Pourquoi ce fichier existe

Les générateurs de PDF imprimaient une identité codée en dur :

| Champ | Valeur imprimée | État |
|---|---|---|
| SIRET | 925 487 312 00018 | **inventé** (échoue la clé de Luhn) |
| SIREN | 925 487 312 | **inventé** (échoue la clé de Luhn) |
| TVA | FR42 925487312 | **inventé** (la clé calculée pour ce SIREN est 05, pas 42) |
| EORI | FR92548731200018 | **inventé** (dérivé du SIRET ci-dessus) |
| RCS | Paris 925 487 312 | **inventé** |
| Adresse | 14 rue de la Logistique, 75015 Paris | **inventée** |
| Téléphone | +33 1 84 88 12 00 | **inventé** |
| E-mail / site | support@axis-import.com, axis-import.com | à confirmer |
| Forme / capital | SAS au capital de 10 000 EUR | à confirmer |

Ces valeurs figuraient sur les factures, la facture commerciale export, la
déclaration d'export, le mandat de dédouanement et la liste de colisage.

Le risque est concret : un numéro de TVA introuvable dans
[VIES](https://ec.europa.eu/taxation_customs/vies/) sur une facture
commerciale jointe à un envoi, c'est un motif d'immobilisation en douane —
exactement ce que la liasse documentaire est censée éviter. Une facture
portant une identification fausse n'est par ailleurs pas conforme aux
mentions obligatoires (art. 242 nonies A de l'annexe II au CGI).

## Comment renseigner

Ouvrir `mobile/app.json` et compléter `expo.extra.company` :

```json
"company": {
  "name": "Axis Import SAS",
  "address": "12 rue Exemple",
  "postalCity": "75015 Paris",
  "country": "France",
  "siret": "12345678900018",
  "siren": "123456789",
  "vat": "FR00123456789",
  "eori": "FR12345678900018",
  "rcs": "Paris 123 456 789",
  "legalForm": "SAS au capital de 10 000 EUR",
  "email": "contact@…",
  "phone": "+33 …",
  "website": "…",
  "customsRegistration": ""
}
```

Puis reconstruire l'application.

## En attendant

Tant qu'un champ est vide, le document imprime **`[À COMPLÉTER]`** à sa
place. C'est volontaire : un marqueur visible se remarque et se corrige,
là où un faux numéro parfaitement crédible part chez le client sans que
personne ne le relève.

## Où vérifier ses propres numéros

- SIREN / SIRET : [annuaire-entreprises.data.gouv.fr](https://annuaire-entreprises.data.gouv.fr)
- N° de TVA intracommunautaire : [VIES](https://ec.europa.eu/taxation_customs/vies/)
- EORI : [vérification EORI de la Commission](https://ec.europa.eu/taxation_customs/dds2/eos/eori_validation.jsp)
