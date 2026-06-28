'use client';

import { useState, useRef } from 'react';
import type { Product, CreateProductInput, UpdateProductInput } from '@/lib/types/product';

const PLACEHOLDER_IMG = 'https://placehold.co/200x200?text=Foto';

interface ProductFormProps {
  mode: 'create' | 'edit';
  initial?: Product;
  categories: string[];
  onSubmit: (data: CreateProductInput | UpdateProductInput) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}

/**
 * Formulário único de produto — cria ou edita dependendo de `mode`.
 * Validação num lugar só (nome+preço obrigatórios).
 * SKU: editável no create, readOnly no edit (imutável pós-criação).
 * Combobox de categoria: filtra case-insensitive + permite criar nova.
 */
export function ProductForm({ mode, initial, categories, onSubmit, onCancel, submitting }: ProductFormProps) {
  const [nome, setNome] = useState(initial?.name ?? '');
  const [preco, setPreco] = useState(initial?.price != null ? String(initial.price) : '');
  const [descricao, setDescricao] = useState(initial?.description ?? '');
  const [categoria, setCategoria] = useState(initial?.category ?? '');
  const [categoriaInput, setCategoriaInput] = useState(initial?.category ?? '');
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [unidade, setUnidade] = useState(initial?.unit ?? 'unidade');
  const [custo, setCusto] = useState(initial?.cost_price != null ? String(initial.cost_price) : '');
  const [estoqueInicial, setEstoqueInicial] = useState('');
  const [fotoUrl, setFotoUrl] = useState(initial?.image_url ?? '');
  const [imgErro, setImgErro] = useState(false);
  const [sku, setSku] = useState(initial?.sku ?? '');
  const [erros, setErros] = useState<{ nome?: string; preco?: string }>({});

  const comboboxRef = useRef<HTMLDivElement>(null);

  // Filtragem case-insensitive: inclui categorias cujo nome contém o texto digitado
  const sugestoes = categories.filter((c) =>
    c.toLowerCase().includes(categoriaInput.toLowerCase()),
  );

  function selecionarCategoria(cat: string) {
    setCategoria(cat);
    setCategoriaInput(cat);
    setMostrarSugestoes(false);
  }

  function handleCategoriaChange(valor: string) {
    setCategoriaInput(valor);
    setMostrarSugestoes(true);

    // Match exato case-insensitive: se houver categoria existente com mesmo nome
    // (ignorando maiúsculas/minúsculas), usar o valor existente (preserva o case original).
    const matchExato = categories.find(
      (c) => c.toLowerCase() === valor.toLowerCase(),
    );
    setCategoria(matchExato ?? valor.trim());
  }

  function handleCategoriaBlur() {
    // Pequeno delay para permitir clique na sugestão antes de esconder
    setTimeout(() => setMostrarSugestoes(false), 150);
    // Se o texto digitado bate exato com categoria existente, normalizar
    const matchExato = categories.find(
      (c) => c.toLowerCase() === categoriaInput.toLowerCase(),
    );
    if (matchExato) {
      setCategoriaInput(matchExato);
      setCategoria(matchExato);
    } else {
      setCategoria(categoriaInput.trim());
    }
  }

  /** Validação num lugar só — cobre create e edit. */
  function validar(): boolean {
    const novosErros: { nome?: string; preco?: string } = {};
    if (!nome.trim()) novosErros.nome = 'Nome é obrigatório.';
    const precoNum = Number(preco);
    if (!preco.trim() || isNaN(precoNum) || precoNum < 0) {
      novosErros.preco = 'Preço é obrigatório e deve ser um número válido.';
    }
    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validar()) return;

    const categoriaFinal = categoria.trim() || undefined;

    if (mode === 'create') {
      const payload: CreateProductInput = {
        name: nome.trim(),
        price: Number(preco),
        description: descricao.trim() || undefined,
        category: categoriaFinal,
        unit: unidade.trim() || undefined,
        cost_price: custo ? Number(custo) : undefined,
        initial_stock: estoqueInicial ? Number(estoqueInicial) : undefined,
        image_url: fotoUrl.trim() || undefined,
        // SKU: se vazio, deixar o backend gerar (undefined); se preenchido, enviar
        sku: sku.trim() || undefined,
      };
      await onSubmit(payload);
    } else {
      // No edit: NUNCA enviar sku (imutável pós-criação)
      const payload: UpdateProductInput = {
        name: nome.trim(),
        price: Number(preco),
        description: descricao.trim() || undefined,
        category: categoriaFinal,
        unit: unidade.trim() || undefined,
        cost_price: custo ? Number(custo) : undefined,
        image_url: fotoUrl.trim() || undefined,
      };
      await onSubmit(payload);
    }
  }

  const inputClass =
    'h-11 w-full rounded-[4px] border border-[#1a1814]/15 bg-white px-3 text-[14px] text-[#1a1814] outline-none transition focus:border-[#1a1814]/40 disabled:opacity-60';
  const labelClass = 'block text-[12px] font-medium text-[#1a1814]/70 mb-1';

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 p-6">
      <h2 className="text-[18px] font-medium text-[#1a1814]">
        {mode === 'create' ? 'Novo produto' : 'Editar produto'}
      </h2>

      {/* Nome */}
      <div>
        <label className={labelClass}>Nome *</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className={inputClass}
          placeholder="Ex: Brigadeiro Gourmet"
          aria-label="Nome do produto"
        />
        {erros.nome && <p className="mt-1 text-[12px] text-red-600">{erros.nome}</p>}
      </div>

      {/* Preço */}
      <div>
        <label className={labelClass}>Preço (R$) *</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={preco}
          onChange={(e) => setPreco(e.target.value)}
          className={inputClass}
          placeholder="0,00"
          aria-label="Preço do produto"
        />
        {erros.preco && <p className="mt-1 text-[12px] text-red-600">{erros.preco}</p>}
      </div>

      {/* Descrição */}
      <div>
        <label className={labelClass}>Descrição</label>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={3}
          className={`${inputClass} h-auto py-2`}
          placeholder="Descrição do produto (opcional)"
          aria-label="Descrição do produto"
        />
      </div>

      {/* Categoria — combobox creatable, case-insensitive */}
      <div className="relative" ref={comboboxRef}>
        <label className={labelClass}>Categoria</label>
        <input
          value={categoriaInput}
          onChange={(e) => handleCategoriaChange(e.target.value)}
          onFocus={() => setMostrarSugestoes(true)}
          onBlur={handleCategoriaBlur}
          className={inputClass}
          placeholder="Digite ou selecione uma categoria"
          aria-label="Categoria do produto"
          autoComplete="off"
        />
        {mostrarSugestoes && sugestoes.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-50 mt-1 w-full rounded-[4px] border border-[#1a1814]/10 bg-white shadow-md"
          >
            {sugestoes.map((cat) => (
              <li
                key={cat}
                role="option"
                aria-selected={cat === categoria}
                onMouseDown={() => selecionarCategoria(cat)}
                className={`cursor-pointer px-3 py-2 text-[14px] hover:bg-[#f6f3ee] ${
                  cat === categoria ? 'bg-[#f6f3ee] font-medium' : ''
                }`}
              >
                {cat}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Unidade */}
      <div>
        <label className={labelClass}>Unidade</label>
        <input
          value={unidade}
          onChange={(e) => setUnidade(e.target.value)}
          className={inputClass}
          placeholder="unidade, kg, litro…"
          aria-label="Unidade do produto"
        />
      </div>

      {/* Custo */}
      <div>
        <label className={labelClass}>Preço de custo (R$)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={custo}
          onChange={(e) => setCusto(e.target.value)}
          className={inputClass}
          placeholder="0,00"
          aria-label="Preço de custo"
        />
      </div>

      {/* Estoque inicial — só no create */}
      {mode === 'create' && (
        <div>
          <label className={labelClass}>Estoque inicial</label>
          <input
            type="number"
            min="0"
            step="1"
            value={estoqueInicial}
            onChange={(e) => setEstoqueInicial(e.target.value)}
            className={inputClass}
            placeholder="0"
            aria-label="Estoque inicial"
          />
        </div>
      )}

      {/* Foto por URL */}
      <div>
        <label className={labelClass}>Foto (URL)</label>
        <input
          value={fotoUrl}
          onChange={(e) => { setFotoUrl(e.target.value); setImgErro(false); }}
          className={inputClass}
          placeholder="https://exemplo.com/foto.jpg"
          aria-label="URL da foto do produto"
        />
        <div className="mt-2 h-16 w-16 overflow-hidden rounded-[4px] border border-[#1a1814]/10">
          <img
            src={imgErro || !fotoUrl ? PLACEHOLDER_IMG : fotoUrl}
            alt="Pré-visualização da foto"
            onError={() => setImgErro(true)}
            className="h-full w-full object-cover"
          />
        </div>
      </div>

      {/* SKU — editável no create, readOnly no edit */}
      <div>
        <label className={labelClass}>
          SKU {mode === 'edit' && <span className="text-[#1a1814]/40">(imutável)</span>}
        </label>
        <input
          value={sku}
          onChange={(e) => mode === 'create' && setSku(e.target.value)}
          readOnly={mode === 'edit'}
          className={`${inputClass} ${mode === 'edit' ? 'cursor-default bg-[#f6f3ee]' : ''}`}
          placeholder={mode === 'create' ? 'Deixe vazio para gerar automaticamente' : ''}
          aria-label="SKU do produto"
        />
      </div>

      {/* Ações */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-[#1a1814] text-[14px] font-medium text-[#f6f3ee] transition hover:bg-[#1a1814]/90 disabled:opacity-50"
        >
          {submitting ? 'Salvando…' : mode === 'create' ? 'Criar produto' : 'Salvar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="inline-flex h-11 items-center justify-center rounded-full border border-[#1a1814]/15 px-5 text-[14px] font-medium text-[#1a1814] transition hover:bg-[#1a1814]/5 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
