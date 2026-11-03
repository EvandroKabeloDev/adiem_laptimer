# Ajuste — somente karts cadastrados no portal

## O que mudou
- Removida da interface a coluna/campo legado “Kart RT004 padrão”.
- A distribuição da sessão agora solicita somente transponder, kart cadastrado no portal e piloto.
- O inventário de transponders mostra somente o kart padrão do portal e o piloto padrão.
- A chamada da função `set_rt004_session_transponder_v2` continua sendo usada, enviando `p_rt004_kart_id: null`.

## Compatibilidade e segurança dos dados
- Nenhuma tabela, coluna, constraint, função SQL ou registro foi removido.
- `rt004_kart_id` e `rt004_karts` permanecem no banco para compatibilidade com dados e voltas antigas.
- As novas associações continuam gravando `portal_kart_id`, `pilot_id`, `session_id`, `transponder_id` e os horários.
- As voltas continuam vinculadas ao `portal_kart_id` e à associação temporal `session_transponder_id`.

## Importante
A função SQL `set_rt004_session_transponder_v2` precisa aceitar `p_rt004_kart_id = NULL`.
A tabela `rt004_session_transponders.rt004_kart_id` já foi informada como nullable. Se a implementação PL/pgSQL da função tiver validação que rejeite NULL, será necessário ajustar essa validação antes do deploy.
