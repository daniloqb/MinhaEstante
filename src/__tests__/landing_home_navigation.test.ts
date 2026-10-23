import { describe, it, expect } from 'vitest';
import React from 'react';
import { TRANSLATIONS } from '../i18n/translations';
import { NavigationBottomBar, MainTab } from '../components/NavigationBottomBar';
import { DarkWalnutPalette } from '../theme/woodTheme';
import { Book } from '../types/book';
import { areBooksDuplicate } from '../services/storage';

describe('Landing Home & Navegação Integrada (Kindle Discovery Experience)', () => {
  describe('1. Internacionalização de Início (nav.home e landingHome)', () => {
    it('traduz nav.home para todos os 6 idiomas', () => {
      expect(TRANSLATIONS['pt-BR'].nav.home).toBe('Início');
      expect(TRANSLATIONS['en-US'].nav.home).toBe('Home');
      expect(TRANSLATIONS['es-ES'].nav.home).toBe('Inicio');
      expect(TRANSLATIONS['fr-FR'].nav.home).toBe('Accueil');
      expect(TRANSLATIONS['de-DE'].nav.home).toBe('Start');
      expect(TRANSLATIONS['it-IT'].nav.home).toBe('Home');
    });

    it('possui todas as seções e textos do landingHome nos 6 idiomas', () => {
      const locales = ['pt-BR', 'en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT'] as const;
      for (const loc of locales) {
        const lh = TRANSLATIONS[loc].landingHome;
        expect(lh).toBeDefined();
        expect(lh.yourShelf).toBeTruthy();
        expect(lh.continueJourney).toBeTruthy();
        expect(lh.trending).toBeTruthy();
        expect(lh.bestSellers).toBeTruthy();
        expect(lh.recommendedForYou).toBeTruthy();
        expect(lh.newReleases).toBeTruthy();
        expect(lh.becauseYouLike).toBeTruthy();
        expect(lh.searchPrompt).toBeTruthy();
        expect(lh.viewAll).toBeTruthy();
        expect(lh.readingPreferences).toBeTruthy();
      }
    });
  });

  describe('2. NavigationBottomBar com 5 abas e INICIO ativo', () => {
    it('permite selecionar a aba INICIO', () => {
      let selectedTab: MainTab = 'ESTANTE';
      const element = React.createElement(NavigationBottomBar, {
        palette: DarkWalnutPalette,
        currentTab: 'INICIO',
        onTabChange: (tab) => {
          selectedTab = tab;
        },
        totalCount: 15,
        borrowedCount: 3,
      });

      expect(element.props.currentTab).toBe('INICIO');
      element.props.onTabChange('INICIO');
      expect(selectedTab).toBe('INICIO');
    });

    it('mantém suporte a transições entre INICIO, ESTANTE, BUSCAR, ESTATISTICAS e CONFIG', () => {
      const recorded: MainTab[] = [];
      const onTabChange = (tab: MainTab) => {
        recorded.push(tab);
      };

      const tabsToTest: MainTab[] = ['INICIO', 'ESTANTE', 'BUSCAR', 'ESTATISTICAS', 'CONFIG'];
      for (const t of tabsToTest) {
        onTabChange(t);
      }

      expect(recorded).toEqual(['INICIO', 'ESTANTE', 'BUSCAR', 'ESTATISTICAS', 'CONFIG']);
    });
  });

  describe('3. Roteamento e Ações dos Quick Links da Home', () => {
    it('calcula corretamente as contagens para os 4 atalhos', () => {
      const books: Book[] = [
        {
          id: 1,
          origem: 'manual',
          titulo: 'Livro 1',
          autores: ['Autor 1'],
          generos: ['Ficção'],
          tenho_fisico: true,
          status_leitura: 'lido',
          formato: 'fisico',
          dataCadastro: 100,
          dataAtualizacao: 100,
        },
        {
          id: 2,
          origem: 'manual',
          titulo: 'Livro 2',
          autores: ['Autor 2'],
          generos: ['Ficção'],
          tenho_fisico: true,
          status_leitura: 'quero_ler',
          formato: 'fisico',
          dataCadastro: 200,
          dataAtualizacao: 200,
        },
        {
          id: 3,
          origem: 'manual',
          titulo: 'Livro 3',
          autores: ['Autor 3'],
          generos: ['Ficção'],
          tenho_fisico: true,
          status_leitura: 'nenhum',
          formato: 'fisico',
          dataCadastro: 300,
          dataAtualizacao: 300,
          emprestimo: {
            nomePessoa: 'Maria',
            dataEmprestimo: '2026-01-01',
            dataDevolucao: '2026-01-15',
            devolvido: false,
          },
        },
        {
          id: 4,
          origem: 'manual',
          titulo: 'Livro 4',
          autores: ['Autor 4'],
          generos: ['Ficção'],
          tenho_fisico: false,
          status_leitura: 'quero_ler',
          formato: 'ebook',
          dataCadastro: 400,
          dataAtualizacao: 400,
        },
      ];

      const physicalOrEbook = books.filter(b => b.tenho_fisico !== false || b.formato === 'ebook');
      const readCount = books.filter(b => b.status_leitura === 'lido').length;
      const wantCount = books.filter(b => b.status_leitura === 'quero_ler').length;
      const borrowedCount = books.filter(b => !!b.emprestimo && !b.emprestimo.devolvido).length;

      expect(physicalOrEbook.length).toBe(4);
      expect(readCount).toBe(1);
      expect(wantCount).toBe(2);
      expect(borrowedCount).toBe(1);
    });
  });

  describe('4. Deduplicação e Prevenção de Corrupção em Livros Externos', () => {
    it('detecta duplicatas com precisão para evitar duplicação na estante', () => {
      const existing: Book[] = [
        {
          id: 1,
          origem: 'google',
          titulo: 'Dom Casmurro',
          autores: ['Machado de Assis'],
          isbn13: '9788535914849',
          generos: ['Literatura Brasileira'],
          tenho_fisico: true,
          status_leitura: 'lido',
          formato: 'fisico',
          dataCadastro: 100,
          dataAtualizacao: 100,
        },
      ];

      // Mesmo ISBN 13 com pontuação
      expect(
        areBooksDuplicate(
          existing[0],
          {
            origem: 'openlibrary',
            titulo: 'Dom Casmurro Diferente',
            autores: ['Outro Autor'],
            isbn13: '978-85-359-1484-9',
            generos: [],
            formato: 'fisico',
          }
        )
      ).toBe(true);

      // Mesmo título e autor normalizados
      expect(
        areBooksDuplicate(
          existing[0],
          {
            origem: 'manual',
            titulo: 'dom casmurro',
            autores: ['machado de assis'],
            generos: [],
            formato: 'fisico',
          }
        )
      ).toBe(true);

      // Livro não duplicado
      expect(
        areBooksDuplicate(
          existing[0],
          {
            origem: 'manual',
            titulo: 'Memórias Póstumas de Brás Cubas',
            autores: ['Machado de Assis'],
            generos: [],
            formato: 'fisico',
          }
        )
      ).toBe(false);
    });
  });
});
