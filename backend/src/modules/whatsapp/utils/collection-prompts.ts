/**
 * Mensagens "prompt" do bot durante a coleta de dados:
 *   - correcao: o usuario tentou corrigir um campo da etapa atual
 *   - recap: o bot acabou de mostrar um resumo e quer trazer o usuario
 *     de volta para a proxima informacao necessaria
 *   - unresolved support: estrategia de retomada quando o cliente sinaliza
 *     que a resposta nao ajudou
 *
 * Funcoes puras - sem this. Antes ficavam inline em whatsapp.service.ts.
 */

import { ConversationState, CustomerData } from '../types/whatsapp.types';

/**
 * Texto incentivando o cliente a reenviar o dado corretamente, sem
 * resetar o resto do contexto da conversa.
 */
export function getCollectionCorrectionPrompt(
  currentState: ConversationState,
  customerData?: CustomerData,
): string {
  switch (currentState) {
    case 'collecting_name':
      return 'Pode me mandar o nome completo do jeito certo que eu ajusto sem apagar o resto.';
    case 'collecting_address':
      return customerData?.delivery_type
        ? 'Pode me mandar o endereco novamente do seu jeito que eu remonto por partes sem perder o resto do pedido.'
        : 'Sem problema. Antes de qualquer coisa, eu so preciso alinhar se vai ser entrega ou retirada.';
    case 'collecting_phone':
      return 'Pode me mandar o telefone novamente com DDD que eu corrijo aqui.';
    case 'collecting_notes':
      return 'Pode me mandar a observacao do jeito certo que eu atualizo isso para a equipe.';
    case 'collecting_cash_change':
      return 'Pode me dizer o troco correto, por exemplo: "troco para 100".';
    case 'confirming_stock_adjustment':
      return 'Me diga a quantidade certa que eu ajusto sem estourar o estoque.';
    case 'confirming_order':
      return 'Me diga exatamente o que ajustar: item, quantidade, entrega ou retirada, endereco, telefone ou observacao.';
    default:
      return 'Pode me dizer exatamente o que eu preciso corrigir que eu sigo dai.';
  }
}

/**
 * Pos-resumo: bot acabou de listar tudo conhecido e quer reorientar o
 * cliente para a proxima informacao necessaria.
 */
export function getCollectionRecapGuidance(
  currentState: ConversationState,
  customerData?: CustomerData,
): string {
  switch (currentState) {
    case 'collecting_name':
      return 'Se isso estiver certo ate aqui, agora eu so preciso do nome completo de quem vai receber o pedido.';
    case 'collecting_address':
      return customerData?.delivery_type
        ? 'Se isso estiver certo ate aqui, agora eu so preciso do endereco de entrega.'
        : 'Se isso estiver certo ate aqui, agora eu so preciso saber se voce prefere entrega ou retirada.';
    case 'collecting_phone':
      return 'Se isso estiver certo ate aqui, agora eu so preciso do telefone de contato com DDD.';
    case 'collecting_notes':
      return 'Se isso estiver certo ate aqui, agora eu so preciso saber se existe alguma observacao importante.';
    case 'collecting_cash_change':
      return 'Se isso estiver certo ate aqui, agora eu so preciso saber o troco para quanto.';
    case 'confirming_stock_adjustment':
      return 'Se isso estiver certo ate aqui, confirme a quantidade sugerida ou me diga a quantidade correta.';
    case 'confirming_order':
      return 'Se algo estiver errado, me diga exatamente o que ajustar. Se estiver tudo certo, responda "sim" ou "confirmar".';
    default:
      return 'Se estiver tudo certo ate aqui, pode me dizer o proximo passo que eu continuo com voce.';
  }
}

/**
 * Quando o cliente reclama que a resposta nao ajudou, sugere o proximo
 * ponto de retomada baseado na etapa atual + ultimo intent reconhecido.
 *
 * `lastIntent` deve ser a string crua da memoria do bot
 * (e.g. 'recommendation', 'comparison', 'budget', ...). Aceita undefined.
 */
export function buildUnresolvedSupportNextStep(
  currentState?: ConversationState,
  customerData?: CustomerData,
  lastIntent?: string | null,
): string {
  switch (currentState) {
    case 'collecting_name':
      return 'Me diga so se o que travou esta no nome, nos itens ou no recebimento.';
    case 'collecting_address':
      return customerData?.delivery_type
        ? 'Me diga so o que ficou errado no endereco.'
        : 'Me diga so se travou em entrega ou retirada, ou no endereco.';
    case 'collecting_phone':
      return 'Me diga so se o ponto travado esta no telefone ou em alguma etapa anterior.';
    case 'collecting_notes':
      return 'Me diga so se quer ajustar o pedido ou seguir sem observacao.';
    case 'collecting_cash_change':
      return 'Me diga so se quer informar outro troco ou mudar a forma de pagamento.';
    case 'confirming_stock_adjustment':
      return 'Me diga so a quantidade certa que eu ajusto daqui.';
    case 'confirming_order':
      return 'Me diga so o que precisa ajustar: itens, nome, recebimento, endereco, telefone ou observacao.';
    case 'waiting_payment':
      return 'Me diga so qual ponto ficou em aberto: gerar pix, confirmar pagamento ou mudar para dinheiro.';
    case 'order_confirmed':
    case 'order_completed':
      return 'Me diga so qual ponto ficou em aberto: andamento, entrega, retirada ou pagamento.';
    default:
      if (
        ['recommendation', 'comparison', 'budget', 'objection', 'suggestion'].includes(
          String(lastIntent || ''),
        )
      ) {
        return 'Me diga so onde eu preciso te ajudar melhor: escolher item, comparar, ajustar valor ou fechar pedido.';
      }

      return 'Me diga so qual ponto ficou em aberto: produto, pedido, pagamento ou entrega.';
  }
}

/**
 * Guia residual quando o bot vai tentar de novo no proximo turno.
 */
export function buildUnresolvedSupportRetryGuidance(
  currentState?: ConversationState,
): string {
  if (currentState === 'waiting_payment') {
    return 'Se quiser, eu ainda tento por aqui: me diga "pix", "ja paguei" ou "dinheiro".';
  }

  const interactiveStates: ConversationState[] = [
    'collecting_name',
    'collecting_address',
    'collecting_phone',
    'collecting_notes',
    'collecting_cash_change',
    'confirming_stock_adjustment',
    'confirming_order',
  ];

  if (currentState && interactiveStates.includes(currentState)) {
    return 'Se quiser, eu ainda tento por aqui: me diga so o ponto exato que travou agora.';
  }

  return 'Se quiser, eu ainda tento por aqui: me diga so o ponto que ficou em aberto.';
}
