import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DefinicionFlujo, DefinicionFlujoCrear } from '../models/flujo.model';

@Injectable({ providedIn: 'root' })
export class FlujoService {
  private readonly baseUrl = `${environment.apiUrl}/flujos`;

  constructor(private readonly http: HttpClient) {}

  listarPorTipoDocumento(tipoDocumentoId: number): Observable<DefinicionFlujo[]> {
    return this.http.get<DefinicionFlujo[]>(this.baseUrl, { params: { tipoDocumentoId } });
  }

  crear(dto: DefinicionFlujoCrear): Observable<DefinicionFlujo> {
    return this.http.post<DefinicionFlujo>(this.baseUrl, dto);
  }
}
