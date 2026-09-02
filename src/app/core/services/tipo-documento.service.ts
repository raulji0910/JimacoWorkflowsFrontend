import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TipoDocumento, TipoDocumentoActualizar, TipoDocumentoCrear } from '../models/tipo-documento.model';

@Injectable({ providedIn: 'root' })
export class TipoDocumentoService {
  private readonly baseUrl = `${environment.apiUrl}/tiposdocumento`;

  constructor(private readonly http: HttpClient) {}

  listar(): Observable<TipoDocumento[]> {
    return this.http.get<TipoDocumento[]>(this.baseUrl);
  }

  obtener(id: number): Observable<TipoDocumento> {
    return this.http.get<TipoDocumento>(`${this.baseUrl}/${id}`);
  }

  crear(dto: TipoDocumentoCrear): Observable<TipoDocumento> {
    return this.http.post<TipoDocumento>(this.baseUrl, dto);
  }

  actualizar(id: number, dto: TipoDocumentoActualizar): Observable<TipoDocumento> {
    return this.http.put<TipoDocumento>(`${this.baseUrl}/${id}`, dto);
  }
}
