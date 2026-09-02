import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CambiarPassword, Usuario, UsuarioActualizar, UsuarioCrear } from '../models/usuario.model';

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly baseUrl = `${environment.apiUrl}/usuarios`;

  constructor(private readonly http: HttpClient) {}

  listar(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(this.baseUrl);
  }

  crear(dto: UsuarioCrear): Observable<Usuario> {
    return this.http.post<Usuario>(this.baseUrl, dto);
  }

  actualizar(id: number, dto: UsuarioActualizar): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.baseUrl}/${id}`, dto);
  }

  cambiarMiPassword(dto: CambiarPassword): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/mi-password`, dto);
  }
}
