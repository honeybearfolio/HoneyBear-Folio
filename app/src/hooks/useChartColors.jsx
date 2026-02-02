import { useLayoutEffect, useState } from 'react';
import useIsDark from './useIsDark';

export default function useChartColors() {
  const isDark = useIsDark();

  const [colors, setColors] = useState({
    // Initial/fallback values
    primary: '#f98c07',
    secondary: '#716a67',
    success: '#10b981',
    line: '#f98c07',
    profit: '#10b981',
    loss: '#f43f5e',
    text: '#615a57',
    grid: '#d2cfce',
    background: '#f6f5f5',
    palette: []
  });

  useLayoutEffect(() => {
    // Read computed styles from the root element to get CSS variables
    const style = getComputedStyle(document.documentElement);
    const getVal = (name) => style.getPropertyValue(name).trim();

    const brand300 = getVal('--color-brand-300') || '#ffc44a';
    const brand400 = getVal('--color-brand-400') || '#ffab20';
    const brand500 = getVal('--color-brand-500') || '#f98c07';
    const brand700 = getVal('--color-brand-700') || '#b74506';

    const slate50 = getVal('--color-slate-50') || '#f6f5f5';
    const slate200 = getVal('--color-slate-200') || '#d2cfce';
    const slate400 = getVal('--color-slate-400') || '#8c8582';
    const slate500 = getVal('--color-slate-500') || '#716a67';
    const slate600 = getVal('--color-slate-600') || '#615a57';
    const slate800 = getVal('--color-slate-800') || '#474240';
    const slate900 = getVal('--color-slate-900') || '#3e3a38';

    // Standard financial colors (hardcoded as requested)
    const emerald500 = '#10b981';
    const rose500 = '#f43f5e';

    setColors({
      primary: brand500,
      secondary: slate500,
      success: emerald500,
      line: brand500,
      profit: emerald500,
      loss: rose500,
      text: isDark ? slate400 : slate600,
      grid: isDark ? slate800 : slate200,
      background: isDark ? slate900 : slate50,
      palette: [
        brand500,
        slate600,
        brand300,
        slate400,
        brand700,
        slate800,
        brand400,
        slate500,
      ],
    });
  }, [isDark]);

  return colors;
}
