import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import App from '../App';
import { useSession } from '../../stores/session';
import { addFiles } from '../../services/document/pipeline';
import { buildLocalQuiz, buildFlashcards, gradeOpenLocal } from '../../engines/education-engine';
import { searchConcepts } from '../../modules/visual-engine/ConceptSearch';
import { AfirmacionView } from '../../components/AfirmacionView';

test('pantalla inicial', () => {
  render(<App />);
  expect(screen.getByText(/Explóralo/)).toBeInTheDocument();
  expect(screen.getByText('Seleccionar archivos')).toBeInTheDocument();
  expect(screen.getByText(/al recargar o cerrar la pestaña todo se borra/i)).toBeInTheDocument();
});

test('procesa un DOCX, muestra el material y genera actividades', async () => {
  const buf = readFileSync('tests/fixtures/parto.docx');
  render(<App />);
  addFiles([new File([buf], 'parto.docx')]);
  expect(await screen.findByText('Explorar en 3D', {}, { timeout: 8000 })).toBeInTheDocument();
  const s = useSession.getState();
  const plan = s.plans[s.materials[0].docId!];
  expect(screen.getByText(plan.dominio.tema)).toBeInTheDocument();
  expect(screen.getByText(/Pelvis y canal del parto/)).toBeInTheDocument();
  // actividades
  const quiz = buildLocalQuiz(plan, undefined, 10);
  expect(quiz.length).toBe(10);
  for (const q of quiz) {
    if (q.tipo !== 'abierta') expect(q.opciones![q.correcta!]).toBeDefined();
    expect(q.respuestaModelo.origen).toBe('documento');
  }
  expect(buildFlashcards(plan).length).toBeGreaterThan(20);
  expect(searchConcepts(plan, 'oxito')[0].nombre).toBe('Oxitocina');
  expect(gradeOpenLocal('El miometrio.', 'el miometrio').resultado).toBe('correcta');
  // abrir estudio
  fireEvent.click(screen.getByText('Estudiar'));
  expect(await screen.findByText('Aprendizaje guiado')).toBeInTheDocument();
  // archivo dañado: error legible y el material anterior sigue
  addFiles([new File(['basura'], 'roto.docx')]);
  fireEvent.click(screen.getAllByText('Inicio')[0]);
  expect(await screen.findByText(/No se pudo leer el archivo/, {}, { timeout: 8000 })).toBeInTheDocument();
  expect(useSession.getState().materials.filter((m) => m.status === 'listo')).toHaveLength(1);
});

test('procedencia visible', () => {
  render(<AfirmacionView a={{ texto: 'x', origen: 'complementario', verificada: false }} />);
  expect(screen.getByText(/no verificada en el documento/i)).toBeInTheDocument();
  expect(screen.getByText('Complementario')).toBeInTheDocument();
});
