import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ActualizarCantidadesDisponibles, HojaAlistamientoDetalle, HojaAlistamientoResumen } from '../models/hoja-alistamiento.model';

@Injectable({ providedIn: 'root' })
export class HojaAlistamientoService {
  private readonly baseUrl = `${environment.apiUrl}/HojasAlistamiento`;

  constructor(private readonly http: HttpClient) {}

  listar(): Observable<HojaAlistamientoResumen[]> {
    return this.http.get<HojaAlistamientoResumen[]>(this.baseUrl);
  }

  obtener(id: number): Observable<HojaAlistamientoDetalle> {
    return this.http.get<HojaAlistamientoDetalle>(`${this.baseUrl}/${id}`);
  }

  actualizarCantidades(documentoVinculadoId: number, dto: ActualizarCantidadesDisponibles): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${documentoVinculadoId}/cantidades`, dto);
  }
}
