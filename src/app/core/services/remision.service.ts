import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RemisionDetalle, RemisionTablero } from '../models/remision.model';

/** Un archivo del soporte de entrega con el QR que se le leyó en el navegador (null = ninguno). */
export interface ArchivoEntrega {
  archivo: File;
  qrLeido: string | null;
}

@Injectable({ providedIn: 'root' })
export class RemisionService {
  private readonly baseUrl = `${environment.apiUrl}/Remisiones`;

  constructor(private readonly http: HttpClient) {}

  listar(): Observable<RemisionTablero[]> {
    return this.http.get<RemisionTablero[]>(this.baseUrl);
  }

  obtener(id: number): Observable<RemisionDetalle> {
    return this.http.get<RemisionDetalle>(`${this.baseUrl}/${id}`);
  }

  /** PDF (una o varias) como Blob — se abre en una pestaña nueva para imprimir. */
  pdf(ids: number[]): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/pdf`, { params: { ids: ids.join(',') }, responseType: 'blob' });
  }

  confirmarEntrega(id: number, archivos: ArchivoEntrega[], observacion: string): Observable<RemisionDetalle> {
    const form = new FormData();
    for (const a of archivos) {
      form.append('archivos', a.archivo, a.archivo.name);
      form.append('qrLeidos', a.qrLeido ?? '');
    }
    if (observacion.trim()) form.append('observacion', observacion.trim());
    return this.http.post<RemisionDetalle>(`${this.baseUrl}/${id}/confirmar-entrega`, form);
  }

  soporte(soporteId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/soportes/${soporteId}`, { responseType: 'blob' });
  }
}
