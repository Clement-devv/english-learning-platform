import { render, screen, fireEvent } from '@testing-library/react';
import { it, expect } from 'vitest';
import SummaryPreview from './SummaryPreview';
it('expands and collapses long summaries without interpreting HTML',()=>{
  const text='Reading progress. '.repeat(30)+'<script>not code</script>';
  render(<SummaryPreview text={text}/>);
  expect(screen.queryByText(text)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'See more'}));
  expect(screen.getByText(text)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'See less'}));
  expect(screen.queryByText(text)).not.toBeInTheDocument();
});
