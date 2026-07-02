import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductForm } from './ProductForm';

const categorias = ['Trufas', 'Bombons', 'Tortas'];
const onSubmit = vi.fn().mockResolvedValue(undefined);
const onCancel = vi.fn();

describe('ProductForm', () => {
  describe('Validação — mesma regra cobre create e edit', () => {
    it('exibe erro quando nome está vazio no create', async () => {
      render(
        <ProductForm
          mode="create"
          categories={categorias}
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />,
      );
      fireEvent.submit(screen.getByRole('button', { name: /Criar produto/i }));
      expect(await screen.findByText('Nome é obrigatório.')).toBeInTheDocument();
    });

    it('exibe erro quando nome está vazio no edit', async () => {
      render(
        <ProductForm
          mode="edit"
          initial={{ id: '1', tenant_id: 't1', name: '', price: 5, unit: 'unidade', is_active: true }}
          categories={categorias}
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />,
      );
      fireEvent.submit(screen.getByRole('button', { name: /Salvar/i }));
      expect(await screen.findByText('Nome é obrigatório.')).toBeInTheDocument();
    });

    it('exibe erro quando preço está vazio no create', async () => {
      render(
        <ProductForm
          mode="create"
          categories={categorias}
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />,
      );
      await userEvent.type(screen.getByLabelText('Nome do produto'), 'Produto');
      fireEvent.submit(screen.getByRole('button', { name: /Criar produto/i }));
      expect(await screen.findByText(/Preço é obrigatório/)).toBeInTheDocument();
    });
  });

  describe('SKU — read-only no edit', () => {
    it('campo SKU é readOnly no edit', () => {
      render(
        <ProductForm
          mode="edit"
          initial={{ id: '1', tenant_id: 't1', name: 'Trufa', price: 5, sku: 'trufa-001', unit: 'unidade', is_active: true }}
          categories={categorias}
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />,
      );
      const skuInput = screen.getByLabelText('SKU do produto') as HTMLInputElement;
      expect(skuInput.readOnly).toBe(true);
    });

    it('payload do onSubmit no edit NÃO contém sku', async () => {
      const mockSubmit = vi.fn().mockResolvedValue(undefined);
      render(
        <ProductForm
          mode="edit"
          initial={{ id: '1', tenant_id: 't1', name: 'Trufa', price: 5, sku: 'trufa-001', unit: 'unidade', is_active: true }}
          categories={categorias}
          onSubmit={mockSubmit}
          onCancel={onCancel}
          submitting={false}
        />,
      );
      fireEvent.submit(screen.getByRole('button', { name: /Salvar/i }));
      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith(
          expect.not.objectContaining({ sku: expect.anything() }),
        );
      });
    });

    it('campo estoque inicial só aparece no create', () => {
      const { rerender } = render(
        <ProductForm
          mode="create"
          categories={categorias}
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />,
      );
      expect(screen.getByLabelText('Estoque inicial')).toBeInTheDocument();

      rerender(
        <ProductForm
          mode="edit"
          initial={{ id: '1', tenant_id: 't1', name: 'X', price: 1, unit: 'unidade', is_active: true }}
          categories={categorias}
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />,
      );
      expect(screen.queryByLabelText('Estoque inicial')).not.toBeInTheDocument();
    });
  });

  describe('Combobox de categoria — case-insensitive', () => {
    it('digitar "tru" exibe sugestão "Trufas"', async () => {
      render(
        <ProductForm
          mode="create"
          categories={categorias}
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />,
      );
      const input = screen.getByLabelText('Categoria do produto');
      await userEvent.type(input, 'tru');
      expect(await screen.findByText('Trufas')).toBeInTheDocument();
    });

    it('match exato case-insensitive: digitar "trufas" oferece "Trufas" (case original preservado)', async () => {
      const mockSubmit = vi.fn().mockResolvedValue(undefined);
      render(
        <ProductForm
          mode="create"
          categories={categorias}
          onSubmit={mockSubmit}
          onCancel={onCancel}
          submitting={false}
        />,
      );
      const categoriaInput = screen.getByLabelText('Categoria do produto');
      await userEvent.type(categoriaInput, 'trufas'); // minúsculo — bate exato com "Trufas"

      // Clicar na sugestão "Trufas" (case original)
      const sugestao = await screen.findByText('Trufas');
      fireEvent.mouseDown(sugestao);

      // Preencher nome e preço para passar validação
      await userEvent.type(screen.getByLabelText('Nome do produto'), 'Produto Teste');
      await userEvent.type(screen.getByLabelText('Preço do produto'), '10');

      fireEvent.submit(screen.getByRole('button', { name: /Criar produto/i }));

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ category: 'Trufas' }), // case original, não "trufas"
        );
      });
    });
  });

  describe('Foto-URL — fallback para placeholder', () => {
    it('onError na img usa src do placeholder', () => {
      render(
        <ProductForm
          mode="create"
          categories={categorias}
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />,
      );
      const img = screen.getByAltText('Pré-visualização da foto') as HTMLImageElement;
      fireEvent.error(img);
      expect(img.src).toContain('placehold.co');
    });
  });

  describe('C2 — aviso de margem negativa (custo > preço)', () => {
    function renderCreate() {
      render(
        <ProductForm
          mode="create"
          categories={categorias}
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={false}
        />,
      );
    }

    it('avisa quando o custo é maior que o preço de venda', () => {
      renderCreate();
      fireEvent.change(screen.getByLabelText('Preço do produto'), { target: { value: '10' } });
      fireEvent.change(screen.getByLabelText('Preço de custo'), { target: { value: '15' } });
      expect(screen.getByText(/margem ficará negativa/i)).toBeInTheDocument();
    });

    it('não avisa quando o custo é menor que o preço', () => {
      renderCreate();
      fireEvent.change(screen.getByLabelText('Preço do produto'), { target: { value: '10' } });
      fireEvent.change(screen.getByLabelText('Preço de custo'), { target: { value: '6' } });
      expect(screen.queryByText(/margem ficará negativa/i)).not.toBeInTheDocument();
    });

    it('não avisa enquanto um dos campos está vazio', () => {
      renderCreate();
      fireEvent.change(screen.getByLabelText('Preço de custo'), { target: { value: '15' } });
      expect(screen.queryByText(/margem ficará negativa/i)).not.toBeInTheDocument();
    });

    it('não bloqueia o cadastro — é só um alerta (pode ser intencional)', () => {
      renderCreate();
      fireEvent.change(screen.getByLabelText('Preço do produto'), { target: { value: '10' } });
      fireEvent.change(screen.getByLabelText('Preço de custo'), { target: { value: '15' } });
      expect(screen.getByRole('button', { name: /Criar produto/i })).not.toBeDisabled();
    });
  });
});
