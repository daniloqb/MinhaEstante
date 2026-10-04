import React from 'react';
import { ShoppingBag, X, ExternalLink, Tablet, BookOpen } from 'lucide-react';
import { Book } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import { BookCoverView } from './BookCoverView';

interface BookShoppingModalProps {
  palette: WoodPalette;
  book: Book | null;
  isOpen: boolean;
  onDismiss?: () => void;
  onClose?: () => void;
}

export const BookShoppingModal: React.FC<BookShoppingModalProps> = ({
  palette,
  book,
  isOpen,
  onDismiss,
  onClose,
}) => {
  const handleClose = onDismiss || onClose || (() => {});
  if (!isOpen || !book) return null;

  const searchQuery = `${book.titulo} ${book.autores[0] || ''}`.trim();
  const encodedQuery = encodeURIComponent(searchQuery);
  const encodedTitle = encodeURIComponent(book.titulo);

  const stores = [
    {
      name: 'Amazon Brasil',
      badge: 'Livros Físicos & Entrega Rápida',
      color: '#FF9900',
      description: 'Lançamentos, edições físicas e avaliações de leitores',
      url: `https://www.amazon.com.br/s?k=${encodedQuery}&i=stripbooks`,
      highlight: true,
    },
    {
      name: 'Amazon Kindle Store',
      badge: 'Versão Digital / E-book',
      color: '#00A8E1',
      description: 'Download imediato para aplicativo Kindle ou leitor digital',
      url: `https://www.amazon.com.br/s?k=${encodedQuery}&i=digital-text`,
      highlight: book.formato === 'ebook',
    },
    {
      name: 'Estante Virtual',
      badge: 'Novos & Usados / Sebos',
      color: '#E65100',
      description: 'O maior acervo de sebos, livrarias independentes e raridades do Brasil',
      url: `https://www.estantevirtual.com.br/busca?q=${encodedQuery}`,
      highlight: true,
    },
    {
      name: 'Google Shopping',
      badge: 'Comparador de Preços',
      color: '#4285F4',
      description: 'Compara preços entre dezenas de lojas e e-commerces online',
      url: `https://www.google.com/search?tbm=shop&q=livro+${encodedQuery}`,
    },
    {
      name: 'Mercado Livre',
      badge: 'Diversos Vendedores',
      color: '#FFE600',
      textColor: '#333333',
      description: 'Livros novos, seminovos com frete rápido e garantia',
      url: `https://lista.mercadolivre.com.br/livros/${encodedQuery}`,
    },
    {
      name: 'Google Play Livros',
      badge: 'E-book para Android & PC',
      color: '#0F9D58',
      description: 'Compre o e-book oficial diretamente na loja do Google',
      url: `https://play.google.com/store/search?q=${encodedTitle}&c=books`,
      highlight: book.formato === 'ebook',
    },
    {
      name: 'Livraria da Travessa',
      badge: 'Livraria Tradicional',
      color: '#8D1C1D',
      description: 'Catálogo de editoras nacionais, importados e edições especiais',
      url: `https://www.travessa.com.br/busca?q=${encodedQuery}`,
    },
    {
      name: 'Busca Geral na Web',
      badge: 'Todas as Lojas',
      color: '#555555',
      description: 'Pesquisar todas as opções disponíveis no Google',
      url: `https://www.google.com/search?q=comprar+livro+${encodedQuery}`,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden"
        style={{
          backgroundColor: palette.paperSurface,
          borderColor: palette.woodBorder,
          color: palette.textOnPaper,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div
          className="p-4 sm:p-5 border-b flex items-start justify-between gap-3"
          style={{
            backgroundColor: palette.paperSurface,
            borderColor: `${palette.woodBorder}40`,
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="p-2 sm:p-2.5 rounded-xl shadow-md flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: `${palette.goldPrimary}20`,
                borderColor: `${palette.goldPrimary}50`,
                color: palette.goldPrimary,
              }}
            >
              <ShoppingBag size={24} />
            </div>

            <div className="min-w-0">
              <h2 className="font-serif font-bold text-lg sm:text-xl truncate" style={{ color: palette.textOnPaper }}>
                Onde Comprar Online
              </h2>
              <p className="font-serif text-sm truncate opacity-85" style={{ color: palette.textSecondaryOnWood }}>
                {book.titulo} {book.autores[0] ? `• ${book.autores[0]}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-black/10 text-stone-500 hover:text-stone-800 transition-colors cursor-pointer shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Resumo da Obra */}
        <div
          className="mx-4 sm:mx-6 mt-4 p-3 rounded-xl border flex items-center gap-3.5 shadow-sm"
          style={{
            backgroundColor: palette.paperSurfaceElevated,
            borderColor: `${palette.woodBorder}30`,
          }}
        >
          <div className="shrink-0 shadow-md rounded overflow-hidden">
            <BookCoverView
              palette={palette}
              title={book.titulo}
              author={book.autores[0]}
              coverUrl={book.capaUrl}
              width={48}
              height={70}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-serif font-bold text-sm sm:text-base line-clamp-1" style={{ color: palette.textOnPaper }}>
              {book.titulo}
            </h3>
            <p className="text-xs opacity-75 font-serif line-clamp-1">
              {book.autores.join(', ') || 'Autor desconhecido'}
              {book.editora ? ` • ${book.editora}` : ''}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {book.formato === 'ebook' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-sans font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                  <Tablet size={11} /> Formato E-book
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-sans font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  <BookOpen size={11} /> Livro Físico
                </span>
              )}
              {book.isbn13 && (
                <span className="text-[11px] font-mono opacity-70">
                  ISBN: {book.isbn13}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Lista de Lojas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
          <p className="text-xs font-serif italic text-stone-600 mb-2">
            Selecione uma livraria ou plataforma para pesquisar disponibilidade, edições e melhores preços:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {stores.map((store) => (
              <a
                key={store.name}
                href={store.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md cursor-pointer ${
                  store.highlight ? 'ring-1 ring-amber-500/40' : ''
                }`}
                style={{
                  backgroundColor: palette.paperSurface,
                  borderColor: `${palette.woodBorder}40`,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span
                      className="inline-block text-[10px] font-bold font-sans px-2 py-0.5 rounded-full mb-1.5"
                      style={{
                        backgroundColor: `${store.color}20`,
                        color: store.textColor || store.color,
                        border: `1px solid ${store.color}40`,
                      }}
                    >
                      {store.badge}
                    </span>
                    <h4 className="font-serif font-bold text-sm" style={{ color: palette.textOnPaper }}>
                      {store.name}
                    </h4>
                  </div>
                  <ExternalLink size={15} className="text-stone-400 shrink-0 mt-1" />
                </div>

                <p className="text-[11px] text-stone-500 leading-snug line-clamp-2">
                  {store.description}
                </p>
              </a>
            ))}
          </div>
        </div>

        {/* Rodapé */}
        <div
          className="p-3 border-t text-center text-[11px] text-stone-500 font-serif"
          style={{
            backgroundColor: palette.paperSurfaceElevated,
            borderColor: `${palette.woodBorder}40`,
          }}
        >
          Os links abrirão a página de busca correspondente na loja oficial em uma nova aba.
        </div>
      </div>
    </div>
  );
};
